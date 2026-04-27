export type CheckoutPricingLine = {
  price: number
  quantity: number
}

export type CheckoutPricingAddress = {
  country?: string | null
  province?: string | null
}

export type CheckoutPricingDiscount = {
  id: string
  code?: string | null
  title: string
  type: 'CODE' | 'AUTOMATIC'
  method: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y'
  value: number
  minimumOrder?: number | null
  usageLimit?: number | null
  usageCount?: number | null
  status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'DISABLED'
  startsAt?: Date | string | null
  endsAt?: Date | string | null
}

export type CheckoutAppliedDiscount = {
  discountId: string
  code?: string | null
  title: string
  method: CheckoutPricingDiscount['method']
  amount: number
}

export type CheckoutPricingZoneRate = {
  id?: string
  name?: string
  method: 'FLAT' | 'SUBTOTAL_TIER'
  amount: number
  minSubtotal?: number | null
  maxSubtotal?: number | null
  isActive?: boolean
  priority?: number
}

export type CheckoutPricingShippingZone = {
  id?: string
  name?: string
  countryCode?: string
  provinceCode?: string | null
  country?: string
  province?: string | null
  isActive?: boolean
  priority?: number
  rates: CheckoutPricingZoneRate[]
}

export type CheckoutPricingTaxRule = {
  id?: string
  name?: string
  countryCode?: string
  provinceCode?: string | null
  country?: string
  province?: string | null
  rate: number
  isActive?: boolean
  priority?: number
}

export type CheckoutPricingShippingDecision = {
  source: 'none' | 'threshold' | 'zone' | 'fallback'
  amount: number
  destinationCountry?: string
  destinationProvince?: string
  zoneId?: string
  zoneName?: string
  rateId?: string
  rateName?: string
  rateMethod?: CheckoutPricingZoneRate['method']
}

export type CheckoutPricingTaxDecision = {
  source: 'none' | 'rule' | 'fallback'
  rate: number
  amount: number
  destinationCountry?: string
  destinationProvince?: string
  ruleId?: string
  ruleName?: string
}

export type CheckoutPricingResult = {
  subtotal: number
  shippingAmount: number
  taxAmount: number
  discountAmount: number
  total: number
  appliedDiscount?: CheckoutAppliedDiscount
}

export type CheckoutPricingResultWithDecisions = CheckoutPricingResult & {
  shippingDecision: CheckoutPricingShippingDecision
  taxDecision: CheckoutPricingTaxDecision
}

type CheckoutPricingShippingRates = {
  domestic: number
  international: number
}

type CheckoutPricingTaxRates = {
  domestic: number
  international: number
}

const DEFAULT_SHIPPING_RATES: CheckoutPricingShippingRates = {
  domestic: 9.99,
  international: 19.99,
}

const DEFAULT_TAX_RULES: CheckoutPricingTaxRule[] = [
  { countryCode: 'US', provinceCode: 'CA', rate: 0.0825, priority: 10, isActive: true },
  { countryCode: 'US', provinceCode: 'NY', rate: 0.08875, priority: 10, isActive: true },
  { countryCode: 'US', rate: 0.07, priority: 100, isActive: true },
  { countryCode: 'CA', rate: 0.05, priority: 100, isActive: true },
]

export function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function normalizeCountry(value?: string | null) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()

  if (!normalized) return ''
  if (normalized === 'USA' || normalized === 'UNITED STATES' || normalized === 'UNITED STATES OF AMERICA') {
    return 'US'
  }
  if (normalized === 'UK' || normalized === 'UNITED KINGDOM' || normalized === 'GREAT BRITAIN') {
    return 'GB'
  }
  return normalized
}

function normalizeProvince(value?: string | null) {
  return String(value || '')
    .trim()
    .toUpperCase()
}

function isAfterNow(value: Date | string | null | undefined, now: Date) {
  return value ? new Date(value).getTime() > now.getTime() : false
}

function isBeforeNow(value: Date | string | null | undefined, now: Date) {
  return value ? new Date(value).getTime() < now.getTime() : false
}

function getCountryCode(
  input: Pick<CheckoutPricingShippingZone, 'countryCode' | 'country'> | Pick<CheckoutPricingTaxRule, 'countryCode' | 'country'>
) {
  return normalizeCountry(input.countryCode ?? input.country ?? '')
}

function getProvinceCode(
  input:
    | Pick<CheckoutPricingShippingZone, 'provinceCode' | 'province'>
    | Pick<CheckoutPricingTaxRule, 'provinceCode' | 'province'>
) {
  return normalizeProvince(input.provinceCode ?? input.province ?? '')
}

function validateCheckoutDiscount(discount: CheckoutPricingDiscount, subtotal: number, now: Date) {
  if (discount.type !== 'CODE' || !discount.code) {
    throw new Error('Discount code not found')
  }

  if (discount.status !== 'ACTIVE') {
    throw new Error('This discount code is not active')
  }

  if (isAfterNow(discount.startsAt, now)) {
    throw new Error('This discount code is not yet valid')
  }

  if (isBeforeNow(discount.endsAt, now)) {
    throw new Error('This discount code has expired')
  }

  if (discount.usageLimit != null && Number(discount.usageCount ?? 0) >= discount.usageLimit) {
    throw new Error('This discount code has reached its usage limit')
  }

  if (discount.minimumOrder != null && subtotal < discount.minimumOrder) {
    throw new Error(`Minimum order of $${discount.minimumOrder} required`)
  }

  if (discount.method === 'BUY_X_GET_Y') {
    throw new Error('This discount code is not supported at checkout yet')
  }
}

function calculateDiscountAmount(input: {
  discount: CheckoutPricingDiscount
  subtotal: number
  shippingAmount: number
}) {
  const { discount, subtotal, shippingAmount } = input

  if (discount.method === 'PERCENTAGE') {
    return roundCurrency(Math.min(subtotal, subtotal * (Number(discount.value) / 100)))
  }

  if (discount.method === 'FIXED_AMOUNT') {
    return roundCurrency(Math.min(subtotal, Number(discount.value)))
  }

  if (discount.method === 'FREE_SHIPPING') {
    return roundCurrency(shippingAmount)
  }

  return 0
}

function resolveShippingDecision(input: {
  subtotal: number
  shippingThreshold?: number | null
  shippingAddress?: CheckoutPricingAddress
  storeCountry?: string | null
  shippingRates: CheckoutPricingShippingRates
  shippingZones?: CheckoutPricingShippingZone[]
}): CheckoutPricingShippingDecision {
  const destinationCountry = normalizeCountry(input.shippingAddress?.country)
  const destinationProvince = normalizeProvince(input.shippingAddress?.province)

  if (input.subtotal <= 0) {
    return {
      source: 'none',
      amount: 0,
      destinationCountry,
      destinationProvince,
    }
  }

  if (input.shippingThreshold != null && input.subtotal >= input.shippingThreshold) {
    return {
      source: 'threshold',
      amount: 0,
      destinationCountry,
      destinationProvince,
    }
  }

  const zoneCandidates = (input.shippingZones ?? [])
    .filter((zone) => zone.isActive !== false)
    .filter((zone) => getCountryCode(zone) === destinationCountry)
    .filter((zone) => {
      const province = getProvinceCode(zone)
      return !province || province === destinationProvince
    })
    .sort((left, right) => {
      const leftPriority = Number(left.priority ?? 100)
      const rightPriority = Number(right.priority ?? 100)
      if (leftPriority !== rightPriority) return leftPriority - rightPriority

      const leftSpecificity = getProvinceCode(left) ? 1 : 0
      const rightSpecificity = getProvinceCode(right) ? 1 : 0
      if (leftSpecificity !== rightSpecificity) return rightSpecificity - leftSpecificity

      return String(left.name || '').localeCompare(String(right.name || ''))
    })

  const selectedZone = zoneCandidates[0]
  if (selectedZone) {
    const eligibleRates = selectedZone.rates
      .filter((rate) => rate.isActive !== false)
      .filter((rate) => {
        if (rate.method === 'SUBTOTAL_TIER') {
          const minSubtotal = Number(rate.minSubtotal ?? 0)
          const maxSubtotal = rate.maxSubtotal == null ? Number.POSITIVE_INFINITY : Number(rate.maxSubtotal)
          return input.subtotal >= minSubtotal && input.subtotal <= maxSubtotal
        }

        return true
      })
      .sort((left, right) => {
        const leftPriority = Number(left.priority ?? 100)
        const rightPriority = Number(right.priority ?? 100)
        if (leftPriority !== rightPriority) return leftPriority - rightPriority

        const leftTierSpecificity = left.method === 'SUBTOTAL_TIER' ? Number(left.minSubtotal ?? 0) : -1
        const rightTierSpecificity = right.method === 'SUBTOTAL_TIER' ? Number(right.minSubtotal ?? 0) : -1
        return rightTierSpecificity - leftTierSpecificity
      })

    const selectedRate = eligibleRates[0]
    if (selectedRate) {
      return {
        source: 'zone',
        amount: roundCurrency(selectedRate.amount),
        destinationCountry,
        destinationProvince,
        zoneId: selectedZone.id,
        zoneName: selectedZone.name,
        rateId: selectedRate.id,
        rateName: selectedRate.name,
        rateMethod: selectedRate.method,
      }
    }
  }

  const originCountry = normalizeCountry(input.storeCountry)
  const isInternational = destinationCountry && originCountry && destinationCountry !== originCountry
  return {
    source: 'fallback',
    amount: roundCurrency(isInternational ? input.shippingRates.international : input.shippingRates.domestic),
    destinationCountry,
    destinationProvince,
  }
}

function resolveTaxDecision(input: {
  taxableSubtotal: number
  shippingAddress?: CheckoutPricingAddress
  storeCountry?: string | null
  taxRates?: CheckoutPricingTaxRates
  taxRules?: CheckoutPricingTaxRule[]
}): CheckoutPricingTaxDecision {
  const destinationCountry = normalizeCountry(input.shippingAddress?.country)
  const destinationProvince = normalizeProvince(input.shippingAddress?.province)
  if (!destinationCountry) {
    return {
      source: 'none',
      rate: 0,
      amount: 0,
    }
  }

  const explicitRules = input.taxRules ?? []
  if (explicitRules.length) {
    const matchedRules = explicitRules
      .filter((rule) => rule.isActive !== false)
      .filter((rule) => getCountryCode(rule) === destinationCountry)
      .filter((rule) => {
        const province = getProvinceCode(rule)
        return !province || province === destinationProvince
      })
      .sort((left, right) => {
        const leftPriority = Number(left.priority ?? 100)
        const rightPriority = Number(right.priority ?? 100)
        if (leftPriority !== rightPriority) return leftPriority - rightPriority

        const leftSpecificity = getProvinceCode(left) ? 1 : 0
        const rightSpecificity = getProvinceCode(right) ? 1 : 0
        if (leftSpecificity !== rightSpecificity) return rightSpecificity - leftSpecificity

        return String(left.name || '').localeCompare(String(right.name || ''))
      })

    const selectedRule = matchedRules[0]
    if (selectedRule) {
      const rate = Number(selectedRule.rate)
      return {
        source: 'rule',
        rate,
        amount: roundCurrency(input.taxableSubtotal * rate),
        destinationCountry,
        destinationProvince,
        ruleId: selectedRule.id,
        ruleName: selectedRule.name,
      }
    }
  }

  if (input.taxRates) {
    const originCountry = normalizeCountry(input.storeCountry)
    const isInternational = destinationCountry && originCountry && destinationCountry !== originCountry
    const rate = isInternational ? Number(input.taxRates.international) : Number(input.taxRates.domestic)
    return {
      source: 'fallback',
      rate,
      amount: roundCurrency(input.taxableSubtotal * rate),
      destinationCountry,
      destinationProvince,
    }
  }

  const matchedDefaultRules = DEFAULT_TAX_RULES
    .filter((rule) => rule.isActive !== false)
    .filter((rule) => getCountryCode(rule) === destinationCountry)
    .filter((rule) => {
      const province = getProvinceCode(rule)
      return !province || province === destinationProvince
    })
    .sort((left, right) => {
      const leftPriority = Number(left.priority ?? 100)
      const rightPriority = Number(right.priority ?? 100)
      if (leftPriority !== rightPriority) return leftPriority - rightPriority

      const leftSpecificity = getProvinceCode(left) ? 1 : 0
      const rightSpecificity = getProvinceCode(right) ? 1 : 0
      if (leftSpecificity !== rightSpecificity) return rightSpecificity - leftSpecificity

      return String(left.name || '').localeCompare(String(right.name || ''))
    })

  const selectedDefaultRule = matchedDefaultRules[0]
  if (selectedDefaultRule) {
    const rate = Number(selectedDefaultRule.rate)
    return {
      source: 'fallback',
      rate,
      amount: roundCurrency(input.taxableSubtotal * rate),
      destinationCountry,
      destinationProvince,
    }
  }

  return {
    source: 'none',
    rate: 0,
    amount: 0,
    destinationCountry,
    destinationProvince,
  }
}

export function buildCheckoutPricingWithDecisions(
  items: CheckoutPricingLine[],
  shippingThreshold?: number | null,
  options: {
    discount?: CheckoutPricingDiscount | null
    shippingAddress?: CheckoutPricingAddress
    storeCountry?: string | null
    shippingRates?: CheckoutPricingShippingRates
    shippingZones?: CheckoutPricingShippingZone[]
    taxRates?: CheckoutPricingTaxRates
    taxRules?: CheckoutPricingTaxRule[]
    now?: Date
  } = {}
): CheckoutPricingResultWithDecisions {
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0))
  const shippingRates = options.shippingRates ?? DEFAULT_SHIPPING_RATES
  const shippingDecision = resolveShippingDecision({
    subtotal,
    shippingThreshold,
    shippingAddress: options.shippingAddress,
    storeCountry: options.storeCountry,
    shippingRates,
    shippingZones: options.shippingZones,
  })
  const shippingAmount = shippingDecision.amount
  const now = options.now ?? new Date()
  const appliedDiscount = options.discount
    ? (() => {
        validateCheckoutDiscount(options.discount, subtotal, now)
        return {
          discountId: options.discount.id,
          code: options.discount.code,
          title: options.discount.title,
          method: options.discount.method,
          amount: calculateDiscountAmount({
            discount: options.discount,
            subtotal,
            shippingAmount,
          }),
        }
      })()
    : undefined
  const discountAmount = appliedDiscount?.amount ?? 0
  const taxableSubtotal =
    appliedDiscount && (appliedDiscount.method === 'PERCENTAGE' || appliedDiscount.method === 'FIXED_AMOUNT')
      ? Math.max(0, roundCurrency(subtotal - discountAmount))
      : subtotal
  const taxDecision = resolveTaxDecision({
    taxableSubtotal,
    shippingAddress: options.shippingAddress,
    storeCountry: options.storeCountry,
    taxRates: options.taxRates,
    taxRules: options.taxRules,
  })
  const taxAmount = taxDecision.amount
  const total = roundCurrency(subtotal + shippingAmount + taxAmount - discountAmount)

  return {
    subtotal,
    shippingAmount,
    taxAmount,
    discountAmount,
    total,
    shippingDecision,
    taxDecision,
    ...(appliedDiscount ? { appliedDiscount } : {}),
  }
}

export function buildCheckoutPricing(
  items: CheckoutPricingLine[],
  shippingThreshold?: number | null,
  options: {
    discount?: CheckoutPricingDiscount | null
    shippingAddress?: CheckoutPricingAddress
    storeCountry?: string | null
    shippingRates?: CheckoutPricingShippingRates
    shippingZones?: CheckoutPricingShippingZone[]
    taxRates?: CheckoutPricingTaxRates
    taxRules?: CheckoutPricingTaxRule[]
    now?: Date
  } = {}
): CheckoutPricingResult {
  const detailed = buildCheckoutPricingWithDecisions(items, shippingThreshold, options)
  return {
    subtotal: detailed.subtotal,
    shippingAmount: detailed.shippingAmount,
    taxAmount: detailed.taxAmount,
    discountAmount: detailed.discountAmount,
    total: detailed.total,
    ...(detailed.appliedDiscount ? { appliedDiscount: detailed.appliedDiscount } : {}),
  }
}
