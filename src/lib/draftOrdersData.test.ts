import { describe, expect, it } from 'vitest'

import { calculateDraftTotals } from './draftOrdersData'

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
      price: 100,
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
})
