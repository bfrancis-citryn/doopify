import { type Prisma, type ReturnStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { emitInternalEvent } from '@/server/events/dispatcher'
import { issueRefund } from '@/server/services/refund.service'

const ALLOWED_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['APPROVED', 'DECLINED'],
  APPROVED: ['IN_TRANSIT', 'DECLINED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: ['CLOSED'],
  CLOSED: [],
  DECLINED: [],
}

export type CreateReturnInput = {
  orderId: string
  reason?: string
  note?: string
  items: Array<{
    orderItemId: string
    variantId?: string
    quantity: number
    reason?: string
  }>
}

export async function createReturn(input: CreateReturnInput) {
  const { orderId, reason, note, items } = input

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      paymentStatus: true,
      items: { select: { id: true, variantId: true, quantity: true } },
    },
  })

  if (!order) throw new Error('Order not found')
  if (order.paymentStatus !== 'PAID' && order.paymentStatus !== 'PARTIALLY_REFUNDED') {
    throw new Error('Returns can only be created for paid orders')
  }

  const orderItems = new Map(order.items.map(item => [item.id, item]))
  const validatedItems = items.map(item => {
    const orderItem = orderItems.get(item.orderItemId)
    if (!orderItem) throw new Error('Return item does not belong to this order')
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error('Return item quantity must be a positive integer')
    }
    if (item.quantity > orderItem.quantity) {
      throw new Error('Return item quantity exceeds ordered quantity')
    }
    if (item.variantId && orderItem.variantId && item.variantId !== orderItem.variantId) {
      throw new Error('Return item variant does not match the order item')
    }
    return {
      orderItemId: item.orderItemId,
      variantId: orderItem.variantId ?? item.variantId,
      quantity: item.quantity,
      reason: item.reason,
    }
  })

  const returnRecord = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.return.create({
      data: {
        orderId,
        reason,
        note,
        status: 'REQUESTED',
        items: {
          create: validatedItems,
        },
      },
      include: { items: true },
    })

    await tx.orderEvent.create({
      data: {
        orderId,
        type: 'return.requested',
        title: 'Return requested',
        detail: reason || `${items.length} item${items.length === 1 ? '' : 's'} requested for return`,
        actorType: 'SYSTEM',
      },
    })

    return created
  })

  await emitInternalEvent('order.return_requested', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    returnId: returnRecord.id,
  })

  return returnRecord
}

export async function updateReturnStatus(
  returnId: string,
  data: { status: ReturnStatus; note?: string }
) {
  const existing = await prisma.return.findUnique({
    where: { id: returnId },
    select: {
      id: true,
      orderId: true,
      status: true,
      order: { select: { orderNumber: true } },
    },
  })

  if (!existing) throw new Error('Return not found')

  const allowed = ALLOWED_TRANSITIONS[existing.status]
  if (!allowed.includes(data.status)) {
    throw new Error(
      `Cannot transition return from ${existing.status} to ${data.status}`
    )
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const result = await tx.return.update({
      where: { id: returnId },
      data: {
        status: data.status,
        receivedAt: data.status === 'RECEIVED' ? new Date() : undefined,
        note: data.note ?? undefined,
      },
      include: { items: true, refund: true },
    })

    const eventTitles: Partial<Record<ReturnStatus, string>> = {
      APPROVED: 'Return approved',
      DECLINED: 'Return declined',
      IN_TRANSIT: 'Return in transit',
      RECEIVED: 'Return received',
      CLOSED: 'Return closed',
    }

    await tx.orderEvent.create({
      data: {
        orderId: existing.orderId,
        type: `return.${data.status.toLowerCase()}`,
        title: eventTitles[data.status] ?? `Return ${data.status.toLowerCase()}`,
        detail: data.note ?? '',
        actorType: 'STAFF',
      },
    })

    return result
  })

  await emitInternalEvent('order.return_updated', {
    orderId: existing.orderId,
    orderNumber: existing.order.orderNumber,
    returnId,
    status: data.status,
  })

  return updated
}

export async function closeReturnWithRefund(input: {
  returnId: string
  paymentId: string
  amount: number
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  note?: string
  restockItems?: boolean
  items: Array<{
    orderItemId: string
    variantId?: string
    quantity: number
    amount: number
  }>
}) {
  const returnRecord = await prisma.return.findUnique({
    where: { id: input.returnId },
    include: { items: true, refund: true, order: { select: { id: true } } },
  })

  if (!returnRecord) throw new Error('Return not found')
  if (returnRecord.status !== 'RECEIVED') {
    throw new Error('Return must be received before closing with a refund')
  }
  if (returnRecord.refundId || returnRecord.refund) {
    throw new Error('Return already has a refund')
  }

  const returnedByOrderItem = new Map(
    returnRecord.items.map(item => [item.orderItemId, item])
  )

  for (const item of input.items) {
    const returnItem = returnedByOrderItem.get(item.orderItemId)
    if (!returnItem) {
      throw new Error('Refund item does not belong to this return')
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error('Refund item quantity must be a positive integer')
    }
    if (item.quantity > returnItem.quantity) {
      throw new Error('Refund item quantity exceeds returned quantity')
    }
    if (item.variantId && returnItem.variantId && item.variantId !== returnItem.variantId) {
      throw new Error('Refund item variant does not match the return item')
    }
  }

  const refund = await issueRefund({
    orderId: returnRecord.orderId,
    paymentId: input.paymentId,
    amount: input.amount,
    reason: input.reason ?? 'requested_by_customer',
    note: input.note,
    restockItems: input.restockItems ?? true,
    returnId: input.returnId,
    items: input.items,
  })

  await updateReturnStatus(input.returnId, {
    status: 'CLOSED',
    note: input.note ?? 'Return closed after refund was issued',
  })

  return { refund, returnId: input.returnId }
}

export async function getOrderReturns(orderId: string) {
  return prisma.return.findMany({
    where: { orderId },
    include: { items: true, refund: { select: { id: true, amount: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getReturn(returnId: string) {
  return prisma.return.findUnique({
    where: { id: returnId },
    include: { items: true, refund: true },
  })
}
