import { describe, expect, it } from 'vitest'

import {
  normalizeStoreCurrency,
  normalizeStoreTimeZone,
  STORE_CURRENCY_OPTIONS,
  STORE_TIMEZONE_OPTIONS,
} from './store-settings-options'

describe('store-settings-options', () => {
  it('provides curated currency and timezone options', () => {
    expect(STORE_CURRENCY_OPTIONS.map((entry) => entry.value)).toEqual([
      'USD',
      'CAD',
      'GBP',
      'EUR',
      'AUD',
    ])
    expect(STORE_TIMEZONE_OPTIONS.map((entry) => entry.value)).toContain('America/New_York')
    expect(STORE_TIMEZONE_OPTIONS.map((entry) => entry.value)).toContain('UTC')
  })

  it('normalizes currency and falls back to USD when missing/invalid', () => {
    expect(normalizeStoreCurrency('cad')).toBe('CAD')
    expect(normalizeStoreCurrency(undefined)).toBe('USD')
    expect(normalizeStoreCurrency('ZZZ')).toBe('USD')
  })

  it('normalizes timezone and falls back to default when invalid', () => {
    expect(normalizeStoreTimeZone('America/Chicago')).toBe('America/Chicago')
    expect(normalizeStoreTimeZone('Invalid/Timezone')).toBe('America/New_York')
  })
})
