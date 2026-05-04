import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

const WORKSPACE = 'src/components/settings/ShippingSettingsWorkspace.js'

describe('shipping settings UX copy and validation', () => {
  it('uses "Destination country" label (not the old "Region country")', () => {
    const source = read(WORKSPACE)
    expect(source).toContain('label="Destination country"')
    expect(source).not.toContain('label="Region country"')
  })

  it('uses "State / province (optional)" label (not "Region state / province")', () => {
    const source = read(WORKSPACE)
    expect(source).toContain('label="State / province (optional)"')
    expect(source).not.toContain('label="Region state / province"')
  })

  it('explains blank state / province matches all states', () => {
    const source = read(WORKSPACE)
    expect(source).toContain('Leave blank to match all states or provinces')
  })

  it('uses "Min order total" / "Max order total" labels for price-based rates', () => {
    const source = read(WORKSPACE)
    expect(source).toContain('label="Min order total ($)"')
    expect(source).toContain('label="Max order total ($)"')
    // Old "subtotal" labels should be gone from drawer fields
    expect(source).not.toContain('label="Min subtotal ($)"')
    expect(source).not.toContain('label="Max subtotal ($)"')
  })

  it('explains max order total blank or 0 means no maximum', () => {
    const source = read(WORKSPACE)
    expect(source).toContain('Leave blank or enter 0 for no maximum')
  })

  it('shows freeOverAmount only for FREE rate type in an advanced conditions section', () => {
    const source = read(WORKSPACE)
    // The field exists for FREE rate type
    expect(source).toContain('Advanced conditions')
    expect(source).toContain("manualForm.rateType === \"FREE\"")
    expect(source).toContain('freeOverAmount')
    // freeOverAmount is in the advanced/collapsible toggle section
    expect(source).toContain('showAdvancedConditions')
    expect(source).toContain("setShowAdvancedConditions((v) => !v)")
  })

  it('resets conditions when rate type changes to avoid stale field values', () => {
    const source = read(WORKSPACE)
    // onChange for the rate type select should clear condition fields
    expect(source).toContain("minWeight: \"\", maxWeight: \"\", minSubtotal: \"\", maxSubtotal: \"\", freeOverAmount: \"\"")
  })

  it('has client-side validateManualRate function', () => {
    const source = read(WORKSPACE)
    expect(source).toContain('function validateManualRate()')
    expect(source).toContain('"Rate name is required."')
    expect(source).toContain('"Amount must be 0 or greater."')
    expect(source).toContain('"Min weight is required for weight-based rates.')
  })

  it('calls validateManualRate before saving and shows error in the drawer', () => {
    const source = read(WORKSPACE)
    expect(source).toContain('const validationError = validateManualRate()')
    expect(source).toContain('setManualDrawerError(validationError)')
    expect(source).toContain('manualDrawerError')
  })

  it('resets manualDrawerError and showAdvancedConditions when drawer opens', () => {
    const source = read(WORKSPACE)
    expect(source).toContain('setManualDrawerError("")')
    expect(source).toContain('setShowAdvancedConditions(false)')
  })

  it('improves weight-based warning to mention setting min weight to 0', () => {
    const source = read(WORKSPACE)
    expect(source).toContain('set min weight to 0')
  })

  it('keeps flat rate the first / default option in the rate type selector', () => {
    const source = read(WORKSPACE)
    // FLAT should appear before FREE, PRICE_BASED, WEIGHT_BASED in the options array
    const flatIdx = source.indexOf('value: "FLAT"')
    const freeIdx = source.indexOf('value: "FREE"')
    const priceIdx = source.indexOf('value: "PRICE_BASED"')
    const weightIdx = source.indexOf('value: "WEIGHT_BASED"')
    expect(flatIdx).toBeGreaterThan(-1)
    expect(flatIdx).toBeLessThan(freeIdx)
    expect(flatIdx).toBeLessThan(priceIdx)
    expect(flatIdx).toBeLessThan(weightIdx)
  })

  it('keeps DEFAULT_MANUAL_RATE_FORM defaulting to FLAT rate type', () => {
    const source = read(WORKSPACE)
    expect(source).toContain('rateType: "FLAT"')
  })
})
