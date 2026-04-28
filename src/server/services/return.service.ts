import { type Prisma, type ReturnStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { emitInternalEvent } from '@/server/events/dispatcher'

// Valid state machine transitions
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
    select: { id: true, orderNumber: true, paymentStatus: true },
  })

  if (!order) throw new Error('Order not found')
  if (order.paymentStatus !== 'PAID' && order.paymentStatus !== 'PARTIALLY_REFUNDED') {
    throw new Error('Returns can only be created for paid orders')
  }

  const returnRecord = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.return.create({
      data: {
        orderId,
        reason,
        note,
        status: 'REQUESTED',
        items: {
          create: items.map(item => ({
            orderItemId: item.orderItemId,
            variantId: item.variantId,
            quantity: item.quantity,
            reason: item.reason,
          })),
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
