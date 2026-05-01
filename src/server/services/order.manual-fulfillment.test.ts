import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORDER_ID = 'order_1'
const ORDER_ITEM_A = 'oi_a'
const ORDER_ITEM_B = 'oi_b'

const mocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    fulfillment: {
      create: vi.fn(),
    },
    orderEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  emitInternalEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/server/events/dispatcher', () => ({
  emitInternalEvent: mocks.emitInternalEvent,
}))

import { createManualFulfillment } from './order.service'

const baseOrder = {
  id: ORDER_ID,
  paymentStatus: 'PAID',
  items: [
    { id: ORDER_ITEM_A, variantId: 'var_a', quantity: 2 },
    { id: ORDER_ITEM_B, variantId: 'var_b', quantity: 1 },
  ],
  fulfillments: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.prisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mocks.prisma) => Promise<unknown>) => fn(mocks.prisma)
  )
  mocks.prisma.order.update.mockResolvedValue({})
  mocks.prisma.orderEvent.create.mockResolvedValue({})
  mocks.emitInternalEvent.mockResolvedValue(undefined)
})

describe('createManualFulfillment', () => {
  it('creates fulfillment items and marks order partially fulfilled when quantities remain', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.prisma.fulfillment.create.mockResolvedValue({
      id: 'ful_1',
      orderId: ORDER_ID,
      trackingNumber: 'TRACK123',
      items: [{ id: 'fi_1', orderItemId: ORDER_ITEM_A, quantity: 1 }],
    })

    const result = await createManualFulfillment({
      orderId: ORDER_ID,
      items: [{ orderItemId: ORDER_ITEM_A, variantId: 'var_a', quantity: 1 }],
      carrier: 'UPS',
      service: 'Ground',
      trackingNumber: 'TRACK123',
    })

    expect(mocks.prisma.fulfillment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: ORDER_ID,
          carrier: 'UPS',
          service: 'Ground',
          trackingNumber: 'TRACK123',
          items: {
            create: [{ orderItemId: ORDER_ITEM_A, variantId: 'var_a', quantity: 1 }],
          },
        }),
      })
    )
    expect(mocks.prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID },
        data: { fulfillmentStatus: 'PARTIALLY_FULFILLED' },
      })
    )
    expect(mocks.prisma.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: ORDER_ID,
          type: 'MANUAL_FULFILLMENT_CREATED',
          title: 'Manual fulfillment created with tracking TRACK123',
        }),
      })
    )
    expect(mocks.emitInternalEvent).toHaveBeenCalledWith(
      'fulfillment.created',
      expect.objectContaining({
        fulfillmentId: 'ful_1',
        orderId: ORDER_ID,
        trackingNumber: 'TRACK123',
        sendTrackingEmail: false,
      })
    )
    expect(result.id).toBe('ful_1')
  })

  it('emits fulfillment event with tracking-email intent when manual tracking email is requested', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue(baseOrder)
    mocks.prisma.fulfillment.create.mockResolvedValue({
      id: 'ful_2',
      orderId: ORDER_ID,
      trackingNumber: 'TRACK200',
      items: [{ id: 'fi_2', orderItemId: ORDER_ITEM_A, quantity: 1 }],
    })

    await createManualFulfillment({
      orderId: ORDER_ID,
      items: [{ orderItemId: ORDER_ITEM_A, variantId: 'var_a', quantity: 1 }],
      trackingNumber: 'TRACK200',
      sendTrackingEmail: true,
    })

    expect(mocks.prisma.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          detail: 'Tracking email requested from manual fulfillment.',
        }),
      })
    )
    expect(mocks.emitInternalEvent).toHaveBeenCalledWith(
      'fulfillment.created',
      expect.objectContaining({
        fulfillmentId: 'ful_2',
        orderId: ORDER_ID,
        trackingNumber: 'TRACK200',
        sendTrackingEmail: true,
      })
    )
  })

  it('rejects over-fulfillment attempts when requested quantity exceeds remaining quantity', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      fulfillments: [
        {
          status: 'SUCCESS',
          items: [{ orderItemId: ORDER_ITEM_A, quantity: 2 }],
        },
      ],
    })

    await expect(
      createManualFulfillment({
        orderId: ORDER_ID,
        items: [{ orderItemId: ORDER_ITEM_A, quantity: 1 }],
      })
    ).rejects.toThrow('Remaining fulfillable quantity is 0')

    expect(mocks.prisma.fulfillment.create).not.toHaveBeenCalled()
    expect(mocks.prisma.order.update).not.toHaveBeenCalled()
  })

  it('rejects manual fulfillment for unpaid orders', async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      paymentStatus: 'PENDING',
    })

    await expect(
      createManualFulfillment({
        orderId: ORDER_ID,
        items: [{ orderItemId: ORDER_ITEM_A, quantity: 1 }],
      })
    ).rejects.toThrow('only available for paid orders')
  })
})
