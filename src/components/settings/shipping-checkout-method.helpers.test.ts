import { describe, expect, it } from 'vitest'

import {
  buildCheckoutMethodDraft,
  buildCheckoutMethodPatch,
  isCheckoutMethodDirty,
  providerSelectionToLegacyUsage,
} from './shipping-checkout-method.helpers'

describe('shipping checkout method helpers', () => {
  it('marks checkout method dirty when method changes', () => {
    const saved = buildCheckoutMethodDraft('MANUAL', 'NONE', 'NONE', 'SHOW_FALLBACK')
    const next = buildCheckoutMethodDraft('LIVE_RATES', 'EASYPOST', 'EASYPOST', 'SHOW_FALLBACK')

    expect(isCheckoutMethodDirty(next, saved)).toBe(true)
  })

  it('builds save patch with shipping mode, providers, and fallback fields', () => {
    expect(buildCheckoutMethodPatch('MANUAL', 'NONE', 'NONE', 'SHOW_FALLBACK')).toEqual({
      shippingMode: 'MANUAL',
      activeRateProvider: 'NONE',
      labelProvider: 'NONE',
      fallbackBehavior: 'SHOW_FALLBACK',
      shippingLiveProvider: null,
      shippingProviderUsage: 'LIVE_AND_LABELS',
    })

    expect(buildCheckoutMethodPatch('LIVE_RATES', 'SHIPPO', 'SHIPPO', 'HIDE_SHIPPING')).toEqual({
      shippingMode: 'LIVE_RATES',
      activeRateProvider: 'SHIPPO',
      labelProvider: 'SHIPPO',
      fallbackBehavior: 'HIDE_SHIPPING',
      shippingLiveProvider: 'SHIPPO',
      shippingProviderUsage: 'LIVE_AND_LABELS',
    })

    expect(buildCheckoutMethodPatch('HYBRID', 'EASYPOST', 'NONE', 'MANUAL_QUOTE')).toEqual({
      shippingMode: 'HYBRID',
      activeRateProvider: 'EASYPOST',
      labelProvider: 'NONE',
      fallbackBehavior: 'MANUAL_QUOTE',
      shippingLiveProvider: 'EASYPOST',
      shippingProviderUsage: 'LIVE_RATES_ONLY',
    })
  })

  it('maps labels-only usage explicitly', () => {
    expect(providerSelectionToLegacyUsage('NONE', 'SHIPPO')).toBe('LABELS_ONLY')
  })
})
