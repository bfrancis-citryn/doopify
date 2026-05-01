import { prisma } from '@/lib/prisma'

export type ResolvedOrderIdentifier = {
  orderId: string
  orderNumber: number
}

export type OrderIdentifierErrorCode = 'INVALID_IDENTIFIER' | 'ORDER_NOT_FOUND'

export class OrderIdentifierResolutionError extends Error {
  code: OrderIdentifierErrorCode

  constructor(code: OrderIdentifierErrorCode, message: string) {
    super(message)
    this.name = 'OrderIdentifierResolutionError'
    this.code = code
  }
}

function parseOrderNumberCandidate(identifier: string) {
  const withoutHash = identifier.replace(/^#/, '')

  if (/^\d+$/.test(withoutHash)) {
    const parsed = Number.parseInt(withoutHash, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  const dpyMatch = /^DPY0*(\d+)$/i.exec(withoutHash)
  if (dpyMatch) {
    const parsed = Number.parseInt(dpyMatch[1], 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  return null
}

export async function resolveOrderIdentifier(identifier: string): Promise<ResolvedOrderIdentifier> {
  const normalized = String(identifier || '').trim()
  if (!normalized) {
    throw new OrderIdentifierResolutionError('INVALID_IDENTIFIER', 'Invalid order identifier')
  }

  const byId = await prisma.order.findUnique({
    where: { id: normalized },
    select: { id: true, orderNumber: true },
  })

  if (byId) {
    return {
      orderId: byId.id,
      orderNumber: byId.orderNumber,
    }
  }

  const orderNumber = parseOrderNumberCandidate(normalized)
  if (orderNumber == null) {
    throw new OrderIdentifierResolutionError('INVALID_IDENTIFIER', 'Invalid order identifier')
  }

  const byOrderNumber = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, orderNumber: true },
  })

  if (!byOrderNumber) {
    throw new OrderIdentifierResolutionError('ORDER_NOT_FOUND', 'Order not found')
  }

  return {
    orderId: byOrderNumber.id,
    orderNumber: byOrderNumber.orderNumber,
  }
}