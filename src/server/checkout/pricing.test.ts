import { describe, expect, it } from 'vitest'

import { buildCheckoutPricing } from './pricing'

describe('buildCheckoutPricing', () => {
  it('preserves the current subtotal plus flat shipping behavior below threshold', () => {
    expect(
      buildCheckoutPricing(
        [
          { price: 20, quantity: 2 },
          { price: 10, quantity: 1 },
        ],
        75
      )
    ).toEqual({
      subtotal: 50,
      shippingAmount: 9.99,
      taxAmount: 0,
      discountAmount: 0,
      total: 59.99,
    })
  })

  it('keeps shipping free when the subtotal reaches the store threshold', () => {
    expect(buildCheckoutPricing([{ price: 25, quantity: 3 }], 75)).toEqual({
      subtotal: 75,
      shippingAmount: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 75,
    })
  })

  it('does not charge shipping for an empty pricing input', () => {
    expect(buildCheckoutPricing([], 75)).toEqual({
      subtotal: 0,
      shippingAmount: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
    })
  })
})
