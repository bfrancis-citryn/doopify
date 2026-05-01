import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

import {
  OrderIdentifierResolutionError,
  resolveOrderIdentifier,
} from './order-identifier.service'

describe('resolveOrderIdentifier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves by internal order id first', async () => {
    mocks.prisma.order.findUnique
      .mockResolvedValueOnce({ id: 'order_internal_1', orderNumber: 1001 })

    const resolved = await resolveOrderIdentifier('order_internal_1')

    expect(resolved).toEqual({ orderId: 'order_internal_1', orderNumber: 1001 })
    expect(mocks.prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order_internal_1' },
      select: { id: true, orderNumber: true },
    })
  })

  it('resolves numeric display order number when id lookup misses', async () => {
    mocks.prisma.order.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'order_1002', orderNumber: 1002 })

    const resolved = await resolveOrderIdentifier('#1002')

    expect(resolved).toEqual({ orderId: 'order_1002', orderNumber: 1002 })
    expect(mocks.prisma.order.findUnique).toHaveBeenNthCalledWith(2, {
      where: { orderNumber: 1002 },
      select: { id: true, orderNumber: true },
    })
  })

  it('resolves DPY display order number format when supported', async () => {
    mocks.prisma.order.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'order_1003', orderNumber: 1003 })

    const resolved = await resolveOrderIdentifier('#DPY0001003')

    expect(resolved).toEqual({ orderId: 'order_1003', orderNumber: 1003 })
  })

  it('throws invalid identifier for unsupported formats', async () => {
    mocks.prisma.order.findUnique.mockResolvedValueOnce(null)

    await expect(resolveOrderIdentifier('not-an-order')).rejects.toMatchObject({
      name: 'OrderIdentifierResolutionError',
      code: 'INVALID_IDENTIFIER',
      message: 'Invalid order identifier',
    } satisfies Partial<OrderIdentifierResolutionError>)
  })

  it('throws order not found for valid-but-missing order numbers', async () => {
    mocks.prisma.order.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    await expect(resolveOrderIdentifier('1004')).rejects.toMatchObject({
      name: 'OrderIdentifierResolutionError',
      code: 'ORDER_NOT_FOUND',
      message: 'Order not found',
    } satisfies Partial<OrderIdentifierResolutionError>)
  })
})