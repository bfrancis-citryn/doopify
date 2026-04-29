import { type PaymentStatus, type Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { createStripeRefund } from '@/lib/stripe'
import { emitInternalEvent } from '@/server/events/dispatcher'

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function toMinorUnits(value: number) {
  return Math.round(roundCurrency(value) * 100)
}

function derivePaymentStatus(
  originalAmount: number,
  refundedAmount: number
): PaymentStatus {
  return roundCurrency(refundedAmount) >= roundCurrency(originalAmount)
    ? 'REFUNDED'
    : 'PARTIALLY_REFUNDED'
}

export type IssueRefundInput = {
  orderId: string
  paymentId: string
  amount: number
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  note?: string
  restockItems?: boolean
  returnId?: string
  items?: Array<{
    orderItemId: string
    variantId?: string
    quantity: number
    amount: number
  }>
}

type ValidatedRefundItem = {
  orderItemId: string
  variantId?: string
  quantity: number
  amount: number
}

function validateRefundItems(input: {
  order: {
    items?: Array<{
      id: string
      variantId: string | null
      quantity: number
      total: number
      price: number
    }>
    refunds?: Array<{
      status: string
      items: Array<{ orderItemId: string; quantity: number }>
    }>
  }
  amount: number
  items: IssueRefundInput['items']
}) {
  const requestedItems = input.items ?? []
  if (!requestedItems.length) return []

  const orderItems = new Map((input.order.items ?? []).map(item => [item.id, item]))
  const alreadyRefundedByItem = new Map<string, number>()

  for (const refund of input.order.refunds ?? []) {
    if (refund.status !== 'ISSUED' && refund.status !== 'PENDING') continue
    for (const item of refund.items ?? []) {
      alreadyRefundedByItem.set(
        item.orderItemId,
        (alreadyRefundedByItem.get(item.orderItemId) ?? 0) + item.quantity
      )
    }
  }

  let itemAmountTotal = 0
  const validated: ValidatedRefundItem[] = []

  for (const item of requestedItems) {
    const orderItem = orderItems.get(item.orderItemId)
    if (!orderItem) {
      throw new Error('Refund item does not belong to this order')
    }

    const quantity = Number(item.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('Refund item quantity must be a positive integer')
    }

    const alreadyRefunded = alreadyRefundedByItem.get(item.orderItemId) ?? 0
    if (quantity > orderItem.quantity - alreadyRefunded) {
      throw new Error('Refund item quantity exceeds refundable quantity')
    }

    if (item.variantId && orderItem.variantId && item.variantId !== orderItem.variantId) {
      throw new Error('Refund item variant does not match the order item')
    }

    if (roundCurrency(item.amount) <= 0) {
      throw new Error('Refund item amount must be positive')
    }

    const maxItemAmount = roundCurrency((orderItem.total || orderItem.price * orderItem.quantity) * (quantity / orderItem.quantity))
    if (roundCurrency(item.amount) > maxItemAmount) {
      throw new Error('Refund item amount exceeds refundable item amount')
    }

    itemAmountTotal += roundCurrency(item.amount)
    validated.push({
      orderItemId: item.orderItemId,
      variantId: orderItem.variantId ?? item.variantId,
      quantity,
      amount: roundCurrency(item.amount),
    })
  }

  if (roundCurrency(itemAmountTotal) > roundCurrency(input.amount)) {
    throw new Error('Refund item amounts exceed the refund amount')
  }

  return validated
}

export async function issueRefund(input: IssueRefundInput) {
  const { orderId, paymentId, amount, reason, note, restockItems = false, returnId, items = [] } = input

  if (roundCurrency(amount) <= 0) {
    throw new Error('Refund amount must be positive')
  }

  const [order, payment] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        currency: true,
        paymentStatus: true,
        items: {
          select: { id: true, variantId: true, quantity: true, price: true, total: true },
        },
        refunds: {
          select: {
            status: true,
            items: { select: { orderItemId: true, quantity: true } },
          },
        },
      },
    }),
    prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        orderId: true,
        amount: true,
        stripePaymentIntentId: true,
        stripeChargeId: true,
        refunds: { select: { amount: true, status: true } },
      },
    }),
  ])

  if (!order) throw new Error('Order not found')
  if (!payment) throw new Error('Payment not found')
  if (payment.orderId !== order.id) throw new Error('Payment does not belong to this order')
  if (order.paymentStatus !== 'PAID' && order.paymentStatus !== 'PARTIALLY_REFUNDED') {
    throw new Error('Only paid orders can be refunded')
  }

  const alreadyRefunded = payment.refunds
    .filter(r => r.status === 'ISSUED' || r.status === 'PENDING')
    .reduce((sum, r) => sum + r.amount, 0)

  const refundable = roundCurrency(payment.amount - alreadyRefunded)
  if (roundCurrency(amount) > refundable) {
    throw new Error(`Refund amount ${amount} exceeds refundable amount ${refundable}`)
  }

  const validatedItems = validateRefundItems({ order, amount, items })

  const pendingRefund = await prisma.refund.create({
    data: {
      orderId,
      paymentId,
      status: 'PENDING',
      amount: roundCurrency(amount),
      reason,
      note,
      restockItems,
      items: validatedItems.length > 0
        ? {
            create: validatedItems.map(item => ({
              orderItemId: item.orderItemId,
              variantId: item.variantId,
              quantity: item.quantity,
              amount: item.amount,
            })),
          }
        : undefined,
    },
    include: { items: true },
  })

  let stripeRefund: Awaited<ReturnType<typeof createStripeRefund>>
  try {
    stripeRefund = await createStripeRefund({
      chargeId: payment.stripeChargeId,
      paymentIntentId: payment.stripePaymentIntentId,
      amount: toMinorUnits(amount),
      reason,
      idempotencyKey: `refund:${pendingRefund.id}`,
    })
  } catch (error) {
    await prisma.refund.update({
      where: { id: pendingRefund.id },
      data: {
        status: 'FAILED',
        note: note
          ? `${note}\nStripe refund failed before issuing: ${error instanceof Error ? error.message : 'Unknown Stripe error'}`
          : `Stripe refund failed before issuing: ${error instanceof Error ? error.message : 'Unknown Stripe error'}`,
      },
    })
    throw new Error('Stripe refund failed before issuing')
  }

  const newPaymentStatus = derivePaymentStatus(
    payment.amount,
    alreadyRefunded + amount
  )

  const refund = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const issued = await tx.refund.update({
      where: { id: pendingRefund.id },
      data: {
        stripeRefundId: stripeRefund.id,
        status: 'ISSUED',
      },
      include: { items: true },
    })

    if (returnId) {
      await tx.return.update({
        where: { id: returnId },
        data: { refundId: issued.id },
      })
    }

    if (restockItems && validatedItems.length > 0) {
      for (const item of validatedItems) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { inventory: { increment: item.quantity } },
          })
        }
      }
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: newPaymentStatus },
    })

    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: newPaymentStatus },
    })

    await tx.orderEvent.create({
      data: {
        orderId,
        type: 'refund.issued',
        title: 'Refund issued',
        detail: `Refunded ${order.currency} ${roundCurrency(amount)}${reason ? ` — ${reason.replace(/_/g, ' ')}` : ''}`,
        actorType: 'STAFF',
      },
    })

    return issued
  })

  await emitInternalEvent('order.refunded', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    refundId: refund.id,
    amount: refund.amount,
    currency: order.currency,
  })

  await emitInternalEvent('refund.issued', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    refundId: refund.id,
    amount: refund.amount,
    currency: order.currency,
  })

  return refund
}

export async function getOrderRefunds(orderId: string) {
  return prisma.refund.findMany({
    where: { orderId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getRefund(refundId: string) {
  return prisma.refund.findUnique({
    where: { id: refundId },
    include: { items: true },
  })
}
