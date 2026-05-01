import { describe, expect, it } from 'vitest'

import {
  calculateDraftTotals,
  createDraftLineItemFromProduct,
  createDraftOrderSeed,
  resolveDraftLineItemDisplay,
  validateManualDraftCustomer,
} from './draftOrdersData'

const baseDraft = {
  id: 'draft_1',
  customerId: 'cust_1',
  lineItems: [
    {
      id: 'line_1',
      productId: 'prod_1',
      variantId: 'var_1',
      title: 'Shirt',
      variantTitle: 'Default',
      quantity: 1,
      originalPrice: 100,
      price: 100,
      priceOverridden: false,
      priceOverrideAmount: null,
      priceOverrideReason: '',
    },
  ],
  discountId: '',
  customDiscountAmount: 0,
  shippingAmount: '',
  taxAmount: '',
  notes: '',
  paymentStatus: 'pending',
  status: 'draft',
}

describe('calculateDraftTotals', () => {
  it('uses settings-backed shipping and manual tax defaults', () => {
    const totals = calculateDraftTotals(baseDraft, [], {
      freeShippingThreshold: '150',
      domesticShippingRate: '10',
      internationalShippingRate: '20',
      taxEnabled: true,
      taxStrategy: 'MANUAL',
      defaultTaxRatePercent: '8.25',
      taxShipping: true,
      pricesIncludeTax: false,
      taxOriginCountry: 'US',
      taxOriginState: 'CA',
      domesticTaxRate: '7',
      internationalTaxRate: '0',
    })

    expect(totals).toMatchObject({
      subtotal: 100,
      shipping: 10,
      tax: 9.08,
      total: 119.08,
    })
  })

  it('applies free-shipping threshold', () => {
    const totals = calculateDraftTotals(baseDraft, [], {
      freeShippingThreshold: '75',
      domesticShippingRate: '10',
      internationalShippingRate: '20',
      taxEnabled: false,
      taxStrategy: 'NONE',
      defaultTaxRatePercent: '0',
      taxShipping: false,
      pricesIncludeTax: false,
      taxOriginCountry: 'US',
      domesticTaxRate: '0',
      internationalTaxRate: '0',
    })

    expect(totals.shipping).toBe(0)
    expect(totals.total).toBe(100)
  })

  it('respects tax disabled settings', () => {
    const totals = calculateDraftTotals(baseDraft, [], {
      freeShippingThreshold: '',
      domesticShippingRate: '10',
      internationalShippingRate: '20',
      taxEnabled: false,
      taxStrategy: 'MANUAL',
      defaultTaxRatePercent: '8.25',
      taxShipping: true,
      pricesIncludeTax: false,
      taxOriginCountry: 'US',
      domesticTaxRate: '7',
      internationalTaxRate: '0',
    })

    expect(totals.tax).toBe(0)
    expect(totals.total).toBe(110)
  })

  it('uses override amount only when priceOverridden is true', () => {
    const withOverrideDisabled = calculateDraftTotals(
      {
        ...baseDraft,
        lineItems: [
          {
            ...baseDraft.lineItems[0],
            originalPrice: 100,
            priceOverrideAmount: 30,
            priceOverridden: false,
          },
        ],
      },
      [],
      {}
    )

    const withOverrideEnabled = calculateDraftTotals(
      {
        ...baseDraft,
        lineItems: [
          {
            ...baseDraft.lineItems[0],
            originalPrice: 100,
            priceOverrideAmount: 30,
            priceOverridden: true,
            priceOverrideReason: 'Loyalty adjustment',
          },
        ],
      },
      [],
      {}
    )

    expect(withOverrideDisabled.subtotal).toBe(100)
    expect(withOverrideEnabled.subtotal).toBe(30)
  })
})

describe('draft line item snapshots', () => {
  const productFixture = {
    id: 'prod_1',
    title: 'Performance Hoodie',
    basePrice: 78,
    compareAtPrice: 92,
    images: [{ id: 'img_1', url: 'https://cdn.test/hoodie.jpg', altText: 'Hoodie image' }],
    variants: [
      {
        id: 'var_1',
        title: 'Large / Black',
        sku: 'HD-L-BLK',
        price: 82,
        compareAtPrice: 95,
      },
    ],
  }

  it('creates line item snapshots from real variant data', () => {
    const lineItem = createDraftLineItemFromProduct(productFixture, 'var_1')

    expect(lineItem).toMatchObject({
      productId: 'prod_1',
      variantId: 'var_1',
      title: 'Performance Hoodie',
      variantTitle: 'Large / Black',
      sku: 'HD-L-BLK',
      imageUrl: 'https://cdn.test/hoodie.jpg',
      imageAlt: 'Hoodie image',
      originalPrice: 82,
      price: 82,
      priceOverridden: false,
      priceOverrideAmount: null,
      priceOverrideReason: '',
      compareAtPrice: 95,
      quantity: 1,
      taxable: true,
      shippable: true,
    })
  })

  it('preserves snapshot display when product is no longer available', () => {
    const lineItem = {
      id: 'line_2',
      productId: 'deleted_product',
      variantId: 'deleted_variant',
      title: 'Legacy Sneaker',
      variantTitle: 'Size 10 / White',
      sku: 'LEG-10-WHT',
      imageUrl: 'https://cdn.test/legacy.jpg',
      imageAlt: 'Legacy sneaker',
      price: 110,
      compareAtPrice: 140,
      quantity: 2,
      taxable: true,
      shippable: true,
    }

    const display = resolveDraftLineItemDisplay(lineItem, [productFixture])

    expect(display.productMissing).toBe(true)
    expect(display.title).toBe('Legacy Sneaker')
    expect(display.variantTitle).toBe('Size 10 / White')
    expect(display.sku).toBe('LEG-10-WHT')
    expect(display.imageUrl).toBe('https://cdn.test/legacy.jpg')
    expect(display.price).toBe(110)
    expect(display.compareAtPrice).toBe(140)
    expect(display.quantity).toBe(2)
  })

  it('prefers stored snapshot fields when catalog product changed', () => {
    const lineItem = {
      id: 'line_3',
      productId: 'prod_1',
      variantId: 'var_1',
      title: 'Performance Hoodie (Snapshot)',
      variantTitle: 'Large / Graphite',
      sku: 'HD-L-GRP-OLD',
      imageUrl: 'https://cdn.test/snapshot.jpg',
      imageAlt: 'Snapshot image',
      price: 79,
      compareAtPrice: 91,
      quantity: 1,
      taxable: true,
      shippable: true,
    }

    const display = resolveDraftLineItemDisplay(lineItem, [productFixture])

    expect(display.productMissing).toBe(false)
    expect(display.title).toBe('Performance Hoodie (Snapshot)')
    expect(display.variantTitle).toBe('Large / Graphite')
    expect(display.sku).toBe('HD-L-GRP-OLD')
    expect(display.imageUrl).toBe('https://cdn.test/snapshot.jpg')
    expect(display.price).toBe(79)
    expect(display.compareAtPrice).toBe(91)
  })

  it('resolves final unit price from override fields when enabled', () => {
    const display = resolveDraftLineItemDisplay(
      {
        id: 'line_4',
        productId: 'prod_1',
        variantId: 'var_1',
        title: 'Performance Hoodie',
        variantTitle: 'Large / Black',
        quantity: 2,
        originalPrice: 82,
        priceOverridden: true,
        priceOverrideAmount: 65,
        priceOverrideReason: 'Manager approval',
      },
      [productFixture]
    )

    expect(display.originalPrice).toBe(82)
    expect(display.priceOverridden).toBe(true)
    expect(display.priceOverrideAmount).toBe(65)
    expect(display.priceOverrideReason).toBe('Manager approval')
    expect(display.unitPrice).toBe(65)
  })
})

describe('draft customer modes', () => {
  it('seeds existing mode when customers exist', () => {
    const draft = createDraftOrderSeed([], [{ id: 'cust_1' }], [])
    expect(draft.customerMode).toBe('existing')
    expect(draft.customerId).toBe('cust_1')
    expect(draft.manualCustomer).toMatchObject({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      shippingAddress: '',
      billingAddress: '',
    })
  })

  it('seeds guest mode when no customers exist', () => {
    const draft = createDraftOrderSeed([], [], [])
    expect(draft.customerMode).toBe('guest')
    expect(draft.customerId).toBe('')
  })

  it('validates manual customer email', () => {
    const invalid = validateManualDraftCustomer({ email: 'bad-email' })
    expect(invalid.isValid).toBe(false)
    expect(invalid.errors.email).toBe('Enter a valid email address.')

    const valid = validateManualDraftCustomer({
      firstName: '  Sam ',
      lastName: ' Harper ',
      email: '  Sam@Example.com ',
    })
    expect(valid.isValid).toBe(true)
    expect(valid.normalized).toMatchObject({
      firstName: 'Sam',
      lastName: 'Harper',
      email: 'sam@example.com',
    })
  })
})
