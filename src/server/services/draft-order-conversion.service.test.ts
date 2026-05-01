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
