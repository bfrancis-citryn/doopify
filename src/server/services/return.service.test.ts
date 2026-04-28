import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORDER_ID = 'order-1'
const RETURN_ID = 'ret-1'
const ORDER_ITEM_ID = 'oi-1'

const mocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
    return: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    orderEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  emitInternalEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/events/dispatcher', () => ({ emitInternalEvent: mocks.emitInternalEvent }))

import { createReturn, updateReturnStatus, getOrderReturns } from './return.service'

const baseOrder = { id: ORDER_ID, orderNumber: 1001, paymentStatus: 'PAID' }
const baseReturn = {
  id: RETURN_ID,
  orderId: ORDER_ID,
  status: 'REQUESTED' as const,
  reason: 'Wrong size',
  note: null,
  refundId: null,
  receivedAt: null,
  items: [{ id: 'ri-1', returnId: RETURN_ID, orderItemId: ORDER_ITEM_ID, variantId: null, quantity: 1, reason: null }],
}

function setupTx() {
  mocks.prisma.$transaction.mockImplementation(async (fn: (tx: typeof mocks.prisma) => Promise<unknown>) => fn(mocks.prisma))
}

beforeEach(() => {
  vi.clearAllMocks()
  setupTx()
})

describe('createReturn', () => {
  it('creates a return with items and emits an event', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.prisma.return.create.mockResolvedValue(baseReturn)
    mocks.prisma.orderEvent.create.mockResolvedValue({})
    mocks.emitInternalEvent.mockResolvedValue(undefined)

    const result = await createReturn({
      orderId: ORDER_ID,
      reason: 'Wrong size',
      items: [{ orderItemId: ORDER_ITEM_ID, quantity: 1 }],
    })

    expect(mocks.prisma.return.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: ORDER_ID,
          status: 'REQUESTED',
          items: expect.objectContaining({ create: expect.any(Array) }),
        }),
      })
    )
    expect(mocks.emitInternalEvent).toHaveBeenCalledWith('order.return_requested', expect.objectContaining({
      returnId: RETURN_ID,
    }))
    expect(result.id).toBe(RETURN_ID)
  })

  it('throws for unpaid orders', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({ ...baseOrder, paymentStatus: 'PENDING' })

    await expect(
      createReturn({ orderId: ORDER_ID, items: [{ orderItemId: ORDER_ITEM_ID, quantity: 1 }] })
    ).rejects.toThrow('Returns can only be created for paid orders')
  })

  it('throws when order is not found', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(null)

    await expect(
      createReturn({ orderId: 'missing', items: [{ orderItemId: ORDER_ITEM_ID, quantity: 1 }] })
    ).rejects.toThrow('Order not found')
  })
})

describe('updateReturnStatus', () => {
  it('approves a REQUESTED return', async () => {
    mocks.prisma.return.findUnique.mockResolvedValue({ ...baseReturn, order: { orderNumber: 1001 } })
    mocks.prisma.return.update.mockResolvedValue({ ...baseReturn, status: 'APPROVED', items: [], refund: null })
    mocks.prisma.orderEvent.create.mockResolvedValue({})
    mocks.emitInternalEvent.mockResolvedValue(undefined)

    const result = await updateReturnStatus(RETURN_ID, { status: 'APPROVED' })

    expect(result.status).toBe('APPROVED')
    expect(mocks.emitInternalEvent).toHaveBeenCalledWith('order.return_updated', expect.objectContaining({
      returnId: RETURN_ID,
      status: 'APPROVED',
    }))
  })

  it('rejects an invalid state transition', async () => {
    mocks.prisma.return.findUnique.mockResolvedValue({ ...baseReturn, order: { orderNumber: 1001 } })

    await expect(
      updateReturnStatus(RETURN_ID, { status: 'RECEIVED' }) // REQUESTED -> RECEIVED is not allowed
    ).rejects.toThrow('Cannot transition return from REQUESTED to RECEIVED')
  })

  it('sets receivedAt when transitioning to RECEIVED', async () => {
    mocks.prisma.return.findUnique.mockResolvedValue({
      ...baseReturn,
      status: 'IN_TRANSIT',
      order: { orderNumber: 1001 },
    })
    mocks.prisma.return.update.mockResolvedValue({ ...baseReturn, status: 'RECEIVED', items: [], refund: null })
    mocks.prisma.orderEvent.create.mockResolvedValue({})
    mocks.emitInternalEvent.mockResolvedValue(undefined)

    await updateReturnStatus(RETURN_ID, { status: 'RECEIVED' })

    expect(mocks.prisma.return.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ receivedAt: expect.any(Date) }),
      })
    )
  })

  it('declines a REQUESTED return', async () => {
    mocks.prisma.return.findUnique.mockResolvedValue({ ...baseReturn, order: { orderNumber: 1001 } })
    mocks.prisma.return.update.mockResolvedValue({ ...baseReturn, status: 'DECLINED', items: [], refund: null })
    mocks.prisma.orderEvent.create.mockResolvedValue({})
    mocks.emitInternalEvent.mockResolvedValue(undefined)

    const result = await updateReturnStatus(RETURN_ID, { status: 'DECLINED', note: 'Policy violation' })
    expect(result.status).toBe('DECLINED')
  })

  it('throws when return is not found', async () => {
    mocks.prisma.return.findUnique.mockResolvedValue(null)

    await expect(
      updateReturnStatus('missing', { status: 'APPROVED' })
    ).rejects.toThrow('Return not found')
  })
})

describe('getOrderReturns', () => {
  it('returns all returns for an order', async () => {
    mocks.prisma.return.findMany.mockResolvedValue([baseReturn])
    const result = await getOrderReturns(ORDER_ID)
    expect(result).toHaveLength(1)
    expect(mocks.prisma.return.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: ORDER_ID } })
    )
  })
})
