import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
  createOrder: vi.fn(),
  createOrderEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/server/services/order.service', () => ({
  createOrder: mocks.createOrder,
  createOrderEvent: mocks.createOrderEvent,
}))

import {
  convertDraftOrder,
  DraftOrderConversionError,
} from './draft-order-conversion.service'

describe('convertDraftOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('converts draft payload into a real order with cents conversion', async () => {
    mocks.prisma.order.findFirst.mockResolvedValue(null)
    mocks.createOrder.mockResolvedValue({
      id: 'ord_1',
      orderNumber: 1009,
      note: null,
      tags: [],
    })
    mocks.prisma.order.update.mockResolvedValue({})
    mocks.createOrderEvent.mockResolvedValue({})

    const result = await convertDraftOrder({
      draftId: 'draft_1',
      customerId: 'cust_1',
      email: 'sam@example.com',
      paymentStatus: 'pending',
      shippingAmount: 10.25,
      taxAmount: 1.5,
      discountAmount: 5,
      lineItems: [
        {
          productId: 'prod_1',
          variantId: 'var_1',
          title: 'Product',
          variantTitle: 'Default',
          sku: 'SKU-1',
          quantity: 2,
          originalPrice: 49.99,
          priceOverridden: false,
        },
      ],
    })

    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust_1',
        email: 'sam@example.com',
        paymentStatus: 'PENDING',
        decrementInventory: false,
        shippingAmountCents: 1025,
        taxAmountCents: 150,
        discountAmountCents: 500,
        items: [
          expect.objectContaining({
            productId: 'prod_1',
            variantId: 'var_1',
            priceCents: 4999,
            quantity: 2,
          }),
        ],
      })
    )
    expect(result).toEqual({
      duplicate: false,
      orderId: 'ord_1',
      orderNumber: 1009,
      redirectUrl: '/orders/1009',
    })
  })

  it('converts paid draft orders with paid inventory behavior enabled', async () => {
    mocks.prisma.order.findFirst.mockResolvedValue(null)
    mocks.createOrder.mockResolvedValue({
      id: 'ord_paid',
      orderNumber: 1044,
      note: null,
      tags: [],
    })
    mocks.prisma.order.update.mockResolvedValue({})
    mocks.createOrderEvent.mockResolvedValue({})

    await convertDraftOrder({
      draftId: 'draft_paid',
      paymentStatus: 'paid',
      lineItems: [
        {
          productId: 'prod_1',
          variantId: 'var_1',
          title: 'Product',
          quantity: 1,
          originalPrice: 35,
        },
      ],
    })

    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: 'PAID',
        decrementInventory: true,
      })
    )
  })

  it('uses override amount only when override is enabled and creates an audit event', async () => {
    mocks.prisma.order.findFirst.mockResolvedValue(null)
    mocks.createOrder.mockResolvedValue({
      id: 'ord_2',
      orderNumber: 1011,
      note: null,
      tags: [],
    })
    mocks.prisma.order.update.mockResolvedValue({})
    mocks.createOrderEvent.mockResolvedValue({})

    await convertDraftOrder({
      draftId: 'draft_2',
      lineItems: [
        {
          title: 'Product',
          quantity: 1,
          originalPrice: 60,
          priceOverrideAmount: 40,
          priceOverridden: true,
          priceOverrideReason: 'Approved markdown',
        },
      ],
    })

    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ priceCents: 4000 })],
      })
    )
    expect(mocks.createOrderEvent).toHaveBeenCalledWith(
      'ord_2',
      expect.objectContaining({
        type: 'DRAFT_LINE_PRICE_OVERRIDE_APPLIED',
      })
    )
  })

  it('ignores override amount when priceOverridden is false', async () => {
    mocks.prisma.order.findFirst.mockResolvedValue(null)
    mocks.createOrder.mockResolvedValue({
      id: 'ord_3',
      orderNumber: 1012,
      note: null,
      tags: [],
    })
    mocks.prisma.order.update.mockResolvedValue({})
    mocks.createOrderEvent.mockResolvedValue({})

    await convertDraftOrder({
      draftId: 'draft_3',
      lineItems: [
        {
          title: 'Product',
          quantity: 1,
          originalPrice: 55,
          priceOverrideAmount: 5,
          priceOverridden: false,
        },
      ],
    })

    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ priceCents: 5500 })],
      })
    )
  })

  it('returns duplicate conversion payload when draft marker already exists', async () => {
    mocks.prisma.order.findFirst.mockResolvedValue({ id: 'ord_existing', orderNumber: 1002 })

    const result = await convertDraftOrder({
      draftId: 'draft_existing',
      lineItems: [
        {
          title: 'Product',
          quantity: 1,
          price: 10,
        },
      ],
    })

    expect(mocks.createOrder).not.toHaveBeenCalled()
    expect(result).toEqual({
      duplicate: true,
      orderId: 'ord_existing',
      orderNumber: 1002,
      redirectUrl: '/orders/1002',
    })
  })

  it('returns duplicate on retry and does not run a second conversion side effect', async () => {
    mocks.prisma.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'ord_1', orderNumber: 1111 })
    mocks.createOrder.mockResolvedValue({
      id: 'ord_1',
      orderNumber: 1111,
      note: null,
      tags: [],
    })
    mocks.prisma.order.update.mockResolvedValue({})
    mocks.createOrderEvent.mockResolvedValue({})

    const payload = {
      draftId: 'draft_retry',
      paymentStatus: 'paid' as const,
      lineItems: [
        {
          title: 'Product',
          quantity: 1,
          originalPrice: 12,
        },
      ],
    }

    const first = await convertDraftOrder(payload)
    const second = await convertDraftOrder(payload)

    expect(first).toEqual({
      duplicate: false,
      orderId: 'ord_1',
      orderNumber: 1111,
      redirectUrl: '/orders/1111',
    })
    expect(second).toEqual({
      duplicate: true,
      orderId: 'ord_1',
      orderNumber: 1111,
      redirectUrl: '/orders/1111',
    })
    expect(mocks.createOrder).toHaveBeenCalledTimes(1)
  })

  it('wraps paid conversion inventory failures and avoids partial draft conversion metadata', async () => {
    mocks.prisma.order.findFirst.mockResolvedValue(null)
    mocks.createOrder.mockRejectedValue(new Error('Insufficient inventory for variant var_1'))

    await expect(
      convertDraftOrder({
        draftId: 'draft_insufficient',
        paymentStatus: 'paid',
        lineItems: [
          {
            title: 'Product',
            quantity: 4,
            originalPrice: 40,
          },
        ],
      })
    ).rejects.toMatchObject({
      name: 'DraftOrderConversionError',
      code: 'CONVERSION_FAILED',
      message: 'Insufficient inventory for variant var_1',
    } satisfies Partial<DraftOrderConversionError>)

    expect(mocks.prisma.order.update).not.toHaveBeenCalled()
    expect(mocks.createOrderEvent).not.toHaveBeenCalled()
  })

  it('allows pending conversion quantities without inventory mutation by forwarding pending semantics', async () => {
    mocks.prisma.order.findFirst.mockResolvedValue(null)
    mocks.createOrder.mockResolvedValue({
      id: 'ord_pending_large_qty',
      orderNumber: 1301,
      note: null,
      tags: [],
    })
    mocks.prisma.order.update.mockResolvedValue({})
    mocks.createOrderEvent.mockResolvedValue({})

    await convertDraftOrder({
      draftId: 'draft_pending_large_qty',
      paymentStatus: 'pending',
      lineItems: [
        {
          title: 'Product',
          quantity: 999,
          originalPrice: 9.99,
        },
      ],
    })

    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: 'PENDING',
        decrementInventory: false,
        items: [expect.objectContaining({ quantity: 999 })],
      })
    )
  })

  it('throws invalid draft error for missing line items', async () => {
    await expect(
      convertDraftOrder({
        draftId: 'draft_empty',
        lineItems: [],
      })
    ).rejects.toMatchObject({
      name: 'DraftOrderConversionError',
      code: 'INVALID_DRAFT',
    } satisfies Partial<DraftOrderConversionError>)
  })

  it('rejects overridden price without reason', async () => {
    mocks.prisma.order.findFirst.mockResolvedValue(null)

    await expect(
      convertDraftOrder({
        draftId: 'draft_missing_reason',
        lineItems: [
          {
            title: 'Product',
            quantity: 1,
            originalPrice: 20,
            priceOverridden: true,
            priceOverrideAmount: 15,
          },
        ],
      })
    ).rejects.toMatchObject({
      name: 'DraftOrderConversionError',
      code: 'INVALID_DRAFT',
    } satisfies Partial<DraftOrderConversionError>)
  })

  it('rejects negative override amounts', async () => {
    mocks.prisma.order.findFirst.mockResolvedValue(null)

    await expect(
      convertDraftOrder({
        draftId: 'draft_negative_override',
        lineItems: [
          {
            title: 'Product',
            quantity: 1,
            originalPrice: 20,
            priceOverridden: true,
            priceOverrideAmount: -5,
            priceOverrideReason: 'Bad input',
          },
        ],
      })
    ).rejects.toMatchObject({
      name: 'DraftOrderConversionError',
      code: 'INVALID_DRAFT',
    } satisfies Partial<DraftOrderConversionError>)
  })
})
