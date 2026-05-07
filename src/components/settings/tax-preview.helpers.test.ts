import { describe, expect, it } from 'vitest'

import { calculateTaxPreview } from './tax-preview.helpers'

describe('calculateTaxPreview', () => {
  const manualSettings = {
    enabled: true,
    defaultTaxRatePercent: '7.25',
    taxShipping: false,
  }

  it('preview works when manual tax is enabled', () => {
    const result = calculateTaxPreview(
      { subtotal: '100', country: 'US', province: 'CA', shippingAmount: '0' },
      manualSettings,
      [{ name: 'California', countryCode: 'US', provinceCode: 'CA', ratePercent: '8.25', isActive: true }]
    )

    expect(result.estimatedTax).toBe(8.25)
    expect(result.sourceUsed).toContain('California')
  })

  it('returns zero tax when tax collection is disabled', () => {
    const result = calculateTaxPreview(
      { subtotal: '100', country: 'US', province: 'CA', shippingAmount: '20' },
      { enabled: false, defaultTaxRatePercent: '9', taxShipping: true },
      [{ name: 'California', countryCode: 'US', provinceCode: 'CA', ratePercent: '8.25', isActive: true }]
    )

    expect(result.estimatedTax).toBe(0)
    expect(result.note).toContain('Tax collection is off')
  })

  it('includes shipping in taxable base when taxShipping is true', () => {
    const result = calculateTaxPreview(
      { subtotal: '100', shippingAmount: '10', country: 'US', province: '' },
      { ...manualSettings, taxShipping: true },
      []
    )

    expect(result.taxableBase).toBe(110)
    expect(result.estimatedTax).toBe(7.98)
  })

  it('excludes shipping in taxable base when taxShipping is false', () => {
    const result = calculateTaxPreview(
      { subtotal: '100', shippingAmount: '10', country: 'US', province: '' },
      { ...manualSettings, taxShipping: false },
      []
    )

    expect(result.taxableBase).toBe(100)
    expect(result.estimatedTax).toBe(7.25)
  })

  it('returns source/note when no matching rule exists and default applies', () => {
    const result = calculateTaxPreview(
      { subtotal: '50', shippingAmount: '0', country: 'CA', province: 'ON' },
      manualSettings,
      [{ name: 'Texas', countryCode: 'US', provinceCode: 'TX', ratePercent: '8.25', isActive: true }]
    )

    expect(result.sourceUsed).toContain('Default manual rate')
    expect(result.note).toContain('Default/manual rate applied')
  })

  it('throws clear errors for invalid inputs', () => {
    expect(() =>
      calculateTaxPreview({ subtotal: '-1', country: 'US' }, manualSettings, [])
    ).toThrow('Subtotal must be a valid number greater than or equal to 0.')

    expect(() =>
      calculateTaxPreview({ subtotal: '10', shippingAmount: '-3', country: 'US' }, manualSettings, [])
    ).toThrow('Shipping amount must be a valid number greater than or equal to 0.')

    expect(() =>
      calculateTaxPreview({ subtotal: '10', country: '' }, manualSettings, [])
    ).toThrow('Destination country is required.')
  })
})
