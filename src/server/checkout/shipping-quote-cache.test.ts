import { describe, expect, it } from 'vitest'

import {
  buildCheckoutAddressFingerprint,
  buildCheckoutCartFingerprint,
  clearCheckoutShippingQuoteCache,
  getStoredCheckoutShippingQuote,
  isCheckoutShippingQuoteId,
  storeCheckoutShippingQuote,
} from './shipping-quote-cache'

const address = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  address1: '1 Compute Way',
  city: 'London',
  postalCode: 'N1 1AA',
  country: 'GB',
}

const lineItems = [
  {
    variantId: 'variant_1',
    quantity: 2,
    priceCents: 2500,
  },
]

describe('shipping-quote-cache', () => {
  it('stores and loads provider-backed quotes by server-owned quote id', () => {
    clearCheckoutShippingQuoteCache()

    const cartFingerprint = buildCheckoutCartFingerprint(lineItems)
    const addressFingerprint = buildCheckoutAddressFingerprint(address)
    const stored = storeCheckoutShippingQuote({
      quote: {
        id: 'shippo_rate_1',
        source: 'SHIPPO',
        displayName: 'USPS Priority',
        amountCents: 1400,
        currency: 'USD',
        providerRateId: 'shippo_rate_1',
        providerShipmentId: 'shippo_shipment_1',
      },
      cartFingerprint,
      addressFingerprint,
    })

    expect(isCheckoutShippingQuoteId(stored.quoteId)).toBe(true)
    expect(getStoredCheckoutShippingQuote(stored.quoteId)).toMatchObject({
      originalQuoteId: 'shippo_rate_1',
      providerRateId: 'shippo_rate_1',
      providerShipmentId: 'shippo_shipment_1',
      amountCents: 1400,
      currency: 'USD',
    })
  })

  it('expires quotes by ttl', () => {
    clearCheckoutShippingQuoteCache()

    const now = new Date('2026-05-07T12:00:00.000Z')
    const cartFingerprint = buildCheckoutCartFingerprint(lineItems)
    const addressFingerprint = buildCheckoutAddressFingerprint(address)
    const stored = storeCheckoutShippingQuote({
      quote: {
        id: 'easypost_rate_1',
        source: 'EASYPOST',
        displayName: 'UPS Ground',
        amountCents: 1200,
        currency: 'USD',
        providerRateId: 'easypost_rate_1',
      },
      cartFingerprint,
      addressFingerprint,
      now,
      ttlMs: 1000,
    })

    expect(getStoredCheckoutShippingQuote(stored.quoteId, new Date(now.getTime() + 500))).toBeTruthy()
    expect(getStoredCheckoutShippingQuote(stored.quoteId, new Date(now.getTime() + 2000))).toBeNull()
  })
})
