import { type PaymentStatus, type Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { createStripeRefund } from '@/lib/stripe'
import { emitInternalEvent } from '@/server/events/dispatcher'

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
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
  items?: Array<{
    orderItemId: string
    variantId?: string
    quantity: number
    amount: number
  }>
}

export async function issueRefund(input: IssueRefundInput) {
  const { orderId, paymentId, amount, reason, note, restockItems = false, items = [] } = input

  const [order, payment] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, currency: true, paymentStatus: true },
    }),
    prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        amount: true,
        stripePaymentIntentId: true,
        stripeChargeId: true,
        refunds: { select: { amount: true, status: true } },
      },
    }),
  ])

  if (!order) throw new Error('Order not found')
  if (!payment) throw new Error('Payment not found')

  // Calculate total already refunded on this payment
  const alreadyRefunded = payment.refunds
    .filter(r => r.status === 'ISSUED')
    .reduce((sum, r) => sum + r.amount, 0)

  const refundable = roundCurrency(payment.amount - alreadyRefunded)
  if (roundCurrency(amount) > refundable) {
    throw new Error(`Refund amount ${amount} exceeds refundable amount ${refundable}`)
  }

  // Issue refund in Stripe — amount is stored in cents in Stripe
  const stripeRefund = await createStripeRefund({
    chargeId: payment.stripeChargeId,
    paymentIntentId: payment.stripePaymentIntentId,
    amount: Math.round(amount * 100),
    reason,
  })

  const newPaymentStatus = derivePaymentStatus(
    payment.amount,
    alreadyRefunded + amount
  )

  const refund = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.refund.create({
      data: {
        orderId,
        paymentId,
        stripeRefundId: stripeRefund.id,
        status: 'ISSUED',
        amount: roundCurrency(amount),
        reason,
        note,
        restockItems,
        items: items.length > 0
          ? {
              create: items.map(item => ({
                orderItemId: item.orderItemId,
                variantId: item.variantId,
                quantity: item.quantity,
                amount: roundCurrency(item.amount),
              })),
            }
          : undefined,
      },
      include: { items: true },
    })

    // Restock inventory for each line item
    if (restockItems && items.length > 0) {
      for (const item of items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { inventory: { increment: item.quantity } },
          })
        }
      }
    }

    // Update payment and order payment status
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: newPaymentStatus },
    })

    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: newPaymentStatus },
    })

    // Log order event
    await tx.orderEvent.create({
      data: {
        orderId,
        type: 'refund.issued',
        title: 'Refund issued',
        detail: `Refunded ${order.currency} ${roundCurrency(amount)}${reason ? ` — ${reason.replace(/_/g, ' ')}` : ''}`,
        actorType: 'STAFF',
      },
    })

    return created
  })

  await emitInternalEvent('order.refunded', {
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
