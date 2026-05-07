type TaxRuleInput = {
  id?: string
  name?: string
  countryCode?: string
  provinceCode?: string
  ratePercent?: string | number
  isActive?: boolean
}

type TaxSettingsInput = {
  enabled: boolean
  defaultTaxRatePercent?: string | number
  taxShipping: boolean
}

type TaxPreviewInput = {
  subtotal: string | number
  shippingAmount?: string | number
  country: string
  province?: string
}

export type TaxPreviewResult = {
  subtotal: number
  shippingAmount: number
  taxableBase: number
  estimatedTax: number
  totalWithTax: number
  sourceUsed: string
  note: string
}

function toNumber(value: string | number | undefined, fallback = 0) {
  if (value == null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function normalizeRegionValue(value: string | undefined) {
  return String(value || '').trim().toUpperCase()
}

function formatRate(percent: number) {
  return `${percent.toFixed(2)}%`
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateTaxPreview(
  preview: TaxPreviewInput,
  settings: TaxSettingsInput,
  taxRules: TaxRuleInput[]
): TaxPreviewResult {
  const subtotal = toNumber(preview.subtotal)
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new Error('Subtotal must be a valid number greater than or equal to 0.')
  }

  const shippingAmount = toNumber(preview.shippingAmount, 0)
  if (!Number.isFinite(shippingAmount) || shippingAmount < 0) {
    throw new Error('Shipping amount must be a valid number greater than or equal to 0.')
  }

  const country = normalizeRegionValue(preview.country)
  if (!country) {
    throw new Error('Destination country is required.')
  }

  const province = normalizeRegionValue(preview.province)
  const defaultRate = Math.max(0, toNumber(settings.defaultTaxRatePercent, 0))
  const activeRules = (taxRules || []).filter((rule) => rule?.isActive !== false)

  const exactRule =
    activeRules.find((rule) => {
      const ruleCountry = normalizeRegionValue(rule.countryCode)
      const ruleProvince = normalizeRegionValue(rule.provinceCode)
      return ruleCountry === country && Boolean(ruleProvince) && ruleProvince === province
    }) || null

  const countryRule =
    activeRules.find((rule) => {
      const ruleCountry = normalizeRegionValue(rule.countryCode)
      const ruleProvince = normalizeRegionValue(rule.provinceCode)
      return ruleCountry === country && !ruleProvince
    }) || null

  const matchedRule = exactRule || countryRule
  const matchedRate = matchedRule ? Math.max(0, toNumber(matchedRule.ratePercent, 0)) : defaultRate
  const taxableBase = subtotal + (settings.taxShipping ? shippingAmount : 0)

  if (!settings.enabled) {
    return {
      subtotal: roundMoney(subtotal),
      shippingAmount: roundMoney(shippingAmount),
      taxableBase: roundMoney(taxableBase),
      estimatedTax: 0,
      totalWithTax: roundMoney(subtotal + shippingAmount),
      sourceUsed: 'Tax collection disabled',
      note: 'Tax collection is off. Preview tax is $0.00.',
    }
  }

  const estimatedTax = roundMoney(taxableBase * (matchedRate / 100))
  const totalWithTax = roundMoney(subtotal + shippingAmount + estimatedTax)

  if (matchedRule) {
    const ruleName = String(matchedRule.name || 'Manual rule').trim()
    return {
      subtotal: roundMoney(subtotal),
      shippingAmount: roundMoney(shippingAmount),
      taxableBase: roundMoney(taxableBase),
      estimatedTax,
      totalWithTax,
      sourceUsed: `${ruleName} (${formatRate(matchedRate)})`,
      note: 'Manual tax rule matched for this destination.',
    }
  }

  if (matchedRate > 0) {
    return {
      subtotal: roundMoney(subtotal),
      shippingAmount: roundMoney(shippingAmount),
      taxableBase: roundMoney(taxableBase),
      estimatedTax,
      totalWithTax,
      sourceUsed: `Default manual rate (${formatRate(matchedRate)})`,
      note: 'No matching tax rule. Default/manual rate applied.',
    }
  }

  return {
    subtotal: roundMoney(subtotal),
    shippingAmount: roundMoney(shippingAmount),
    taxableBase: roundMoney(taxableBase),
    estimatedTax: 0,
    totalWithTax: roundMoney(subtotal + shippingAmount),
    sourceUsed: 'No applicable rate',
    note: 'No matching tax rule. No tax applied.',
  }
}
