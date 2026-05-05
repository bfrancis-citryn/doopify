import { describe, expect, it } from 'vitest'
import { convertVariantWeightToOz, totalCartWeightOz } from './weight-conversion'

describe('convertVariantWeightToOz', () => {
  it('returns the value unchanged for oz (default unit)', () => {
    expect(convertVariantWeightToOz(12, 'oz')).toBe(12)
    expect(convertVariantWeightToOz(16, 'oz')).toBe(16)
  })

  it('accepts oz aliases (ounce, ounces)', () => {
    expect(convertVariantWeightToOz(8, 'ounce')).toBe(8)
    expect(convertVariantWeightToOz(8, 'ounces')).toBe(8)
  })

  it('converts pounds to oz (1 lb = 16 oz)', () => {
    expect(convertVariantWeightToOz(1, 'lb')).toBe(16)
    expect(convertVariantWeightToOz(2.5, 'lbs')).toBeCloseTo(40)
    expect(convertVariantWeightToOz(1, 'pound')).toBe(16)
    expect(convertVariantWeightToOz(1, 'pounds')).toBe(16)
  })

  it('converts grams to oz (1 g ≈ 0.035274 oz)', () => {
    expect(convertVariantWeightToOz(453.592, 'g')).toBeCloseTo(16, 1) // 1 lb in grams ≈ 16 oz
    expect(convertVariantWeightToOz(100, 'gram')).toBeCloseTo(3.527, 2)
    expect(convertVariantWeightToOz(100, 'grams')).toBeCloseTo(3.527, 2)
  })

  it('converts kilograms to oz (1 kg ≈ 35.274 oz)', () => {
    expect(convertVariantWeightToOz(1, 'kg')).toBeCloseTo(35.274, 2)
    expect(convertVariantWeightToOz(0.5, 'kilogram')).toBeCloseTo(17.637, 2)
    expect(convertVariantWeightToOz(0.5, 'kilograms')).toBeCloseTo(17.637, 2)
  })

  it('returns 0 for null weight', () => {
    expect(convertVariantWeightToOz(null, 'oz')).toBe(0)
    expect(convertVariantWeightToOz(null, 'kg')).toBe(0)
  })

  it('returns 0 for undefined weight', () => {
    expect(convertVariantWeightToOz(undefined, 'oz')).toBe(0)
  })

  it('returns 0 for zero weight', () => {
    expect(convertVariantWeightToOz(0, 'oz')).toBe(0)
    expect(convertVariantWeightToOz(0, 'kg')).toBe(0)
  })

  it('returns 0 for negative weight', () => {
    expect(convertVariantWeightToOz(-5, 'oz')).toBe(0)
  })

  it('returns 0 for NaN weight', () => {
    expect(convertVariantWeightToOz(NaN, 'oz')).toBe(0)
  })

  it('defaults to oz when unit is null or missing', () => {
    expect(convertVariantWeightToOz(10, null)).toBe(10)
    expect(convertVariantWeightToOz(10, undefined)).toBe(10)
    expect(convertVariantWeightToOz(10, '')).toBe(10)
  })

  it('handles unknown unit by defaulting to oz', () => {
    expect(convertVariantWeightToOz(10, 'stone')).toBe(10)
    expect(convertVariantWeightToOz(10, 'OUNCE')).toBe(10)
  })

  it('is case-insensitive for unit strings', () => {
    expect(convertVariantWeightToOz(1, 'KG')).toBeCloseTo(35.274, 2)
    expect(convertVariantWeightToOz(1, 'LB')).toBe(16)
    expect(convertVariantWeightToOz(100, 'G')).toBeCloseTo(3.527, 2)
  })
})

describe('totalCartWeightOz', () => {
  it('returns 0 for an empty cart', () => {
    expect(totalCartWeightOz([])).toBe(0)
  })

  it('sums weight × quantity for a single item', () => {
    expect(totalCartWeightOz([{ weightOz: 8, quantity: 3 }])).toBe(24)
  })

  it('sums weight × quantity across multiple items', () => {
    expect(
      totalCartWeightOz([
        { weightOz: 8, quantity: 2 },  // 16 oz
        { weightOz: 12, quantity: 1 }, // 12 oz
        { weightOz: 4, quantity: 3 },  // 12 oz
      ])
    ).toBe(40)
  })

  it('treats null/undefined weightOz as 0 oz', () => {
    expect(
      totalCartWeightOz([
        { weightOz: null, quantity: 2 },
        { weightOz: undefined, quantity: 1 },
        { weightOz: 10, quantity: 1 },
      ])
    ).toBe(10)
  })

  it('treats zero-weight items as contributing 0 oz', () => {
    expect(
      totalCartWeightOz([
        { weightOz: 0, quantity: 5 },
        { weightOz: 16, quantity: 1 },
      ])
    ).toBe(16)
  })

  it('returns a float for fractional weights (gram-converted variants)', () => {
    const result = totalCartWeightOz([{ weightOz: 3.527, quantity: 2 }])
    expect(result).toBeCloseTo(7.054, 2)
  })
})
