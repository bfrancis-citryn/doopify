import { describe, expect, it } from 'vitest'

import { transformOrder } from './orders-transform'

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ord_1',
    orderNumber: 1001,
    createdAt: '2026-05-01T10:00:00.000Z',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'UNFULFILLED',
    shippingStatusDerived: 'NOT_SHIPPED',
    totalCents: 5000,
    subtotalCents: 4000,
    shippingAmountCents: 700,
    taxAmountCents: 300,
    discountAmountCents: 0,
    channel: 'online',
    items: [{ id: 'oi_1', title: 'Item', quantity: 1, priceCents: 5000 }],
    fulfillments: [],
    addresses: [],
    returns: [],
    events: [],
    ...overrides,
  }
}

describe('OrdersContext transformOrder shipping status mapping', () => {
  it('maps unfulfilled orders to not shipped', () => {
    const order = transformOrder(baseOrder({ shippingStatusDerived: 'NOT_SHIPPED' }))
    expect(order?.fulfillmentStatus).toBe('unfulfilled')
    expect(order?.deliveryStatus).toBe('not shipped')
  })

  it('maps partial fulfillment to partially shipped', () => {
    const order = transformOrder(baseOrder({ shippingStatusDerived: 'PARTIALLY_SHIPPED' }))
    expect(order?.fulfillmentStatus).toBe('partially shipped')
    expect(order?.deliveryStatus).toBe('partially shipped')
  })

  it('maps fulfilled orders to shipped/delivered labels', () => {
    const shippedOrder = transformOrder(baseOrder({ shippingStatusDerived: 'SHIPPED' }))
    const deliveredOrder = transformOrder(baseOrder({ shippingStatusDerived: 'DELIVERED' }))

    expect(shippedOrder?.fulfillmentStatus).toBe('shipped')
    expect(shippedOrder?.deliveryStatus).toBe('shipped')
    expect(deliveredOrder?.fulfillmentStatus).toBe('delivered')
    expect(deliveredOrder?.deliveryStatus).toBe('delivered')
  })
})
