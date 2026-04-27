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

  it('uses international shipping rates when the destination country differs from the store country', () => {
    expect(
      buildCheckoutPricing([{ price: 20, quantity: 1 }], 75, {
        shippingAddress: { country: 'CA' },
        storeCountry: 'US',
      })
    ).toEqual({
      subtotal: 20,
      shippingAmount: 19.99,
      taxAmount: 1,
      discountAmount: 0,
      total: 40.99,
    })
  })

  it('applies destination tax rules for domestic checkout addresses', () => {
    expect(
      buildCheckoutPricing([{ price: 100, quantity: 1 }], 500, {
        shippingAddress: { country: 'US', province: 'CA' },
        storeCountry: 'US',
      })
    ).toEqual({
      subtotal: 100,
      shippingAmount: 9.99,
      taxAmount: 8.25,
      discountAmount: 0,
      total: 118.24,
    })
  })

  it('uses settings-backed shipping and tax rates when provided', () => {
    expect(
      buildCheckoutPricing([{ price: 100, quantity: 1 }], 500, {
        shippingAddress: { country: 'CA' },
        storeCountry: 'US',
        shippingRates: {
          domestic: 12,
          international: 25,
        },
        taxRates: {
          domestic: 0.04,
          international: 0.03,
        },
      })
    ).toEqual({
      subtotal: 100,
      shippingAmount: 25,
      taxAmount: 3,
      discountAmount: 0,
      total: 128,
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

  it('applies active percentage discount codes to the checkout subtotal', () => {
    expect(
      buildCheckoutPricing([{ price: 50, quantity: 2 }], 200, {
        shippingAddress: { country: 'US', province: 'CA' },
        storeCountry: 'US',
        discount: {
          id: 'discount_1',
          code: 'SAVE10',
          title: 'Save 10%',
          type: 'CODE',
          method: 'PERCENTAGE',
          value: 10,
          status: 'ACTIVE',
        },
      })
    ).toEqual({
      subtotal: 100,
      shippingAmount: 9.99,
      taxAmount: 7.43,
      discountAmount: 10,
      total: 107.42,
      appliedDiscount: {
        discountId: 'discount_1',
        code: 'SAVE10',
        title: 'Save 10%',
        method: 'PERCENTAGE',
        amount: 10,
      },
    })
  })

  it('caps fixed amount discounts at the subtotal', () => {
    expect(
      buildCheckoutPricing([{ price: 20, quantity: 1 }], 75, {
        discount: {
          id: 'discount_2',
          code: 'BIGSAVE',
          title: 'Big save',
          type: 'CODE',
          method: 'FIXED_AMOUNT',
          value: 50,
          status: 'ACTIVE',
        },
      })
    ).toMatchObject({
      subtotal: 20,
      shippingAmount: 9.99,
      discountAmount: 20,
      total: 9.99,
    })
  })

  it('represents free shipping discounts as a discount against shipping', () => {
    expect(
      buildCheckoutPricing([{ price: 20, quantity: 1 }], 75, {
        discount: {
          id: 'discount_3',
          code: 'FREESHIP',
          title: 'Free shipping',
          type: 'CODE',
          method: 'FREE_SHIPPING',
          value: 0,
          status: 'ACTIVE',
        },
      })
    ).toMatchObject({
      subtotal: 20,
      shippingAmount: 9.99,
      discountAmount: 9.99,
      total: 20,
    })
  })

  it('rejects inactive, exhausted, or minimum-order discount codes', () => {
    expect(() =>
      buildCheckoutPricing([{ price: 20, quantity: 1 }], 75, {
        discount: {
          id: 'disabled',
          code: 'OFF',
          title: 'Disabled',
          type: 'CODE',
          method: 'PERCENTAGE',
          value: 10,
          status: 'DISABLED',
        },
      })
    ).toThrow('This discount code is not active')

    expect(() =>
      buildCheckoutPricing([{ price: 20, quantity: 1 }], 75, {
        discount: {
          id: 'used',
          code: 'USED',
          title: 'Used',
          type: 'CODE',
          method: 'PERCENTAGE',
          value: 10,
          status: 'ACTIVE',
          usageLimit: 1,
          usageCount: 1,
        },
      })
    ).toThrow('This discount code has reached its usage limit')

    expect(() =>
      buildCheckoutPricing([{ price: 20, quantity: 1 }], 75, {
        discount: {
          id: 'minimum',
          code: 'MINIMUM',
          title: 'Minimum',
          type: 'CODE',
          method: 'PERCENTAGE',
          value: 10,
          status: 'ACTIVE',
          minimumOrder: 50,
        },
      })
    ).toThrow('Minimum order of $50 required')
  })

  it('rejects scheduled and expired discount codes', () => {
    const now = new Date('2026-04-26T12:00:00.000Z')

    expect(() =>
      buildCheckoutPricing([{ price: 20, quantity: 1 }], 75, {
        now,
        discount: {
          id: 'scheduled',
          code: 'SOON',
          title: 'Soon',
          type: 'CODE',
          method: 'PERCENTAGE',
          value: 10,
          status: 'ACTIVE',
          startsAt: new Date('2026-04-27T12:00:00.000Z'),
        },
      })
    ).toThrow('This discount code is not yet valid')

    expect(() =>
      buildCheckoutPricing([{ price: 20, quantity: 1 }], 75, {
        now,
        discount: {
          id: 'expired',
          code: 'OLD',
          title: 'Old',
          type: 'CODE',
          method: 'PERCENTAGE',
          value: 10,
          status: 'ACTIVE',
          endsAt: new Date('2026-04-25T12:00:00.000Z'),
        },
      })
    ).toThrow('This discount code has expired')
  })

  it('rejects non-code and unsupported discount methods at checkout', () => {
    expect(() =>
      buildCheckoutPricing([{ price: 20, quantity: 1 }], 75, {
        discount: {
          id: 'automatic',
          code: null,
          title: 'Automatic',
          type: 'AUTOMATIC',
          method: 'PERCENTAGE',
          value: 10,
          status: 'ACTIVE',
        },
      })
    ).toThrow('Discount code not found')

    expect(() =>
      buildCheckoutPricing([{ price: 20, quantity: 1 }], 75, {
        discount: {
          id: 'bogo',
          code: 'BOGO',
          title: 'BOGO',
          type: 'CODE',
          method: 'BUY_X_GET_Y',
          value: 0,
          status: 'ACTIVE',
        },
      })
    ).toThrow('This discount code is not supported at checkout yet')
  })
})
