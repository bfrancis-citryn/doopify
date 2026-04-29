import { centsToDollars, formatCents } from '@/lib/money'

export type CheckoutPricingLine = {
  priceCents: number
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
  /**
   * PERCENTAGE discounts store a percentage value, such as 10 for 10%.
   * FIXED_AMOUNT discounts store an integer minor-unit value, such as 1000 for $10.00 USD.
   */
  value: number
  minimumOrderCents?: number | null
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
  amountCents: number
  amount?: number
}

export type CheckoutPricingZoneRate = {
  id?: string
  name?: string
  method: 'FLAT' | 'SUBTOTAL_TIER'
  amountCents: number
  minSubtotalCents?: number | null
  maxSubtotalCents?: number | null
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
  amountCents: number
  amount?: number
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
  amountCents: number
  amount?: number
  destinationCountry?: string
  destinationProvince?: string
  ruleId?: string
  ruleName?: string
}

export type CheckoutPricingResult = {
  subtotalCents: number
  shippingAmountCents: number
  taxAmountCents: number
  discountAmountCents: number
  totalCents: number
  subtotal?: number
  shippingAmount?: number
  taxAmount?: number
  discountAmount?: number
  total?: number
  appliedDiscount?: CheckoutAppliedDiscount
}

export type CheckoutPricingResultWithDecisions = CheckoutPricingResult & {
  shippingDecision: CheckoutPricingShippingDecision
  taxDecision: CheckoutPricingTaxDecision
}

type CheckoutPricingShippingRates = {
  domesticCents: number
  internationalCents: number
}

type CheckoutPricingTaxRates = {
  domestic: number
  international: number
}

const DEFAULT_SHIPPING_RATES: CheckoutPricingShippingRates = {
  domesticCents: 999,
  internationalCents: 1999,
}

const DEFAULT_TAX_RULES: CheckoutPricingTaxRule[] = [
  { countryCode: 'US', provinceCode: 'CA', rate: 0.0825, priority: 10, isActive: true },
  { countryCode: 'US', provinceCode: 'NY', rate: 0.08875, priority: 10, isActive: true },
  { countryCode: 'US', rate: 0.07, priority: 100, isActive: true },
  { countryCode: 'CA', rate: 0.05, priority: 100, isActive: true },
]

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

function assertIntegerCents(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer cents value`)
  }
  return value
}

function validateCheckoutDiscount(discount: CheckoutPricingDiscount, subtotalCents: number, now: Date, currency: string) {
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

  if (discount.minimumOrderCents != null) {
    assertIntegerCents(discount.minimumOrderCents, 'Discount minimum order')
  }

  if (discount.minimumOrderCents != null && subtotalCents < discount.minimumOrderCents) {
    throw new Error(`Minimum order of ${formatCents(discount.minimumOrderCents, currency)} required`)
  }

  if (discount.method === 'FIXED_AMOUNT') {
    assertIntegerCents(discount.value, 'Fixed discount amount')
  }

  if (discount.method === 'BUY_X_GET_Y') {
    throw new Error('This discount code is not supported at checkout yet')
  }
}

function calculateDiscountAmountCents(input: {
  discount: CheckoutPricingDiscount
  subtotalCents: number
  shippingAmountCents: number
}) {
  const { discount, subtotalCents, shippingAmountCents } = input

  if (discount.method === 'PERCENTAGE') {
    return Math.min(subtotalCents, Math.round(subtotalCents * (Number(discount.value) / 100)))
  }

  if (discount.method === 'FIXED_AMOUNT') {
    return Math.min(subtotalCents, assertIntegerCents(discount.value, 'Fixed discount amount'))
  }

  if (discount.method === 'FREE_SHIPPING') {
    return shippingAmountCents
  }

  return 0
}

function resolveShippingDecision(input: {
  subtotalCents: number
  shippingThresholdCents?: number | null
  shippingAddress?: CheckoutPricingAddress
  storeCountry?: string | null
  shippingRates: CheckoutPricingShippingRates
  shippingZones?: CheckoutPricingShippingZone[]
}): CheckoutPricingShippingDecision {
  const destinationCountry = normalizeCountry(input.shippingAddress?.country)
  const destinationProvince = normalizeProvince(input.shippingAddress?.province)

  if (input.subtotalCents <= 0) {
    return {
      source: 'none',
      amountCents: 0,
      destinationCountry,
      destinationProvince,
    }
  }

  if (input.shippingThresholdCents != null) {
    assertIntegerCents(input.shippingThresholdCents, 'Shipping threshold')
  }

  if (input.shippingThresholdCents != null && input.subtotalCents >= input.shippingThresholdCents) {
    return {
      source: 'threshold',
      amountCents: 0,
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
        assertIntegerCents(rate.amountCents, 'Shipping rate amount')

        if (rate.method === 'SUBTOTAL_TIER') {
          const minSubtotalCents = rate.minSubtotalCents ?? 0
          const maxSubtotalCents = rate.maxSubtotalCents ?? Number.POSITIVE_INFINITY

          if (minSubtotalCents !== Number.POSITIVE_INFINITY) {
            assertIntegerCents(minSubtotalCents, 'Shipping rate minimum subtotal')
          }
          if (maxSubtotalCents !== Number.POSITIVE_INFINITY) {
            assertIntegerCents(maxSubtotalCents, 'Shipping rate maximum subtotal')
          }

          return input.subtotalCents >= minSubtotalCents && input.subtotalCents <= maxSubtotalCents
        }

        return true
      })
      .sort((left, right) => {
        const leftPriority = Number(left.priority ?? 100)
        const rightPriority = Number(right.priority ?? 100)
        if (leftPriority !== rightPriority) return leftPriority - rightPriority

        const leftTierSpecificity = left.method === 'SUBTOTAL_TIER' ? Number(left.minSubtotalCents ?? 0) : -1
        const rightTierSpecificity = right.method === 'SUBTOTAL_TIER' ? Number(right.minSubtotalCents ?? 0) : -1
        return rightTierSpecificity - leftTierSpecificity
      })

    const selectedRate = eligibleRates[0]
    if (selectedRate) {
      return {
        source: 'zone',
        amountCents: selectedRate.amountCents,
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
    amountCents: isInternational ? input.shippingRates.internationalCents : input.shippingRates.domesticCents,
    destinationCountry,
    destinationProvince,
  }
}

function resolveTaxDecision(input: {
  taxableSubtotalCents: number
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
      amountCents: 0,
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
        amountCents: Math.round(input.taxableSubtotalCents * rate),
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
      amountCents: Math.round(input.taxableSubtotalCents * rate),
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
      amountCents: Math.round(input.taxableSubtotalCents * rate),
      destinationCountry,
      destinationProvince,
    }
  }

  return {
    source: 'none',
    rate: 0,
    amountCents: 0,
    destinationCountry,
    destinationProvince,
  }
}

export function buildCheckoutPricingWithDecisionsCents(
  items: CheckoutPricingLine[],
  shippingThresholdCents?: number | null,
  options: {
    discount?: CheckoutPricingDiscount | null
    shippingAddress?: CheckoutPricingAddress
    storeCountry?: string | null
    shippingRates?: CheckoutPricingShippingRates
    shippingZones?: CheckoutPricingShippingZone[]
    taxRates?: CheckoutPricingTaxRates
    taxRules?: CheckoutPricingTaxRule[]
    now?: Date
    currency?: string
  } = {}
): CheckoutPricingResultWithDecisions {
  const subtotalCents = items.reduce((sum, item) => {
    assertIntegerCents(item.priceCents, 'Line price')
    return sum + item.priceCents * Number(item.quantity)
  }, 0)
  const shippingRates = options.shippingRates ?? DEFAULT_SHIPPING_RATES
  const shippingDecision = resolveShippingDecision({
    subtotalCents,
    shippingThresholdCents,
    shippingAddress: options.shippingAddress,
    storeCountry: options.storeCountry,
    shippingRates,
    shippingZones: options.shippingZones,
  })
  const shippingAmountCents = shippingDecision.amountCents
  const now = options.now ?? new Date()
  const currency = options.currency ?? 'USD'
  const appliedDiscount = options.discount
    ? (() => {
        validateCheckoutDiscount(options.discount, subtotalCents, now, currency)
        return {
          discountId: options.discount.id,
          code: options.discount.code,
          title: options.discount.title,
          method: options.discount.method,
          amountCents: calculateDiscountAmountCents({
            discount: options.discount,
            subtotalCents,
            shippingAmountCents,
          }),
        }
      })()
    : undefined
  const discountAmountCents = appliedDiscount?.amountCents ?? 0
  const taxableSubtotalCents =
    appliedDiscount && (appliedDiscount.method === 'PERCENTAGE' || appliedDiscount.method === 'FIXED_AMOUNT')
      ? Math.max(0, subtotalCents - discountAmountCents)
      : subtotalCents
  const taxDecision = resolveTaxDecision({
    taxableSubtotalCents,
    shippingAddress: options.shippingAddress,
    storeCountry: options.storeCountry,
    taxRates: options.taxRates,
    taxRules: options.taxRules,
  })
  const taxAmountCents = taxDecision.amountCents
  const totalCents = subtotalCents + shippingAmountCents + taxAmountCents - discountAmountCents

  return {
    subtotalCents,
    shippingAmountCents,
    taxAmountCents,
    discountAmountCents,
    totalCents,
    shippingDecision,
    taxDecision,
    ...(appliedDiscount ? { appliedDiscount } : {}),
  }
}

function withDisplayDollars(input: CheckoutPricingResultWithDecisions): CheckoutPricingResultWithDecisions {
  return {
    ...input,
    subtotal: centsToDollars(input.subtotalCents),
    shippingAmount: centsToDollars(input.shippingAmountCents),
    taxAmount: centsToDollars(input.taxAmountCents),
    discountAmount: centsToDollars(input.discountAmountCents),
    total: centsToDollars(input.totalCents),
    shippingDecision: {
      ...input.shippingDecision,
      amount: centsToDollars(input.shippingDecision.amountCents),
    },
    taxDecision: {
      ...input.taxDecision,
      amount: centsToDollars(input.taxDecision.amountCents),
    },
    appliedDiscount: input.appliedDiscount
      ? {
          ...input.appliedDiscount,
          amount: centsToDollars(input.appliedDiscount.amountCents),
        }
      : undefined,
  }
}

export function buildCheckoutPricingWithDecisions(
  items: CheckoutPricingLine[],
  shippingThresholdCents?: number | null,
  options: {
    discount?: CheckoutPricingDiscount | null
    shippingAddress?: CheckoutPricingAddress
    storeCountry?: string | null
    shippingRates?: CheckoutPricingShippingRates
    shippingZones?: CheckoutPricingShippingZone[]
    taxRates?: CheckoutPricingTaxRates
    taxRules?: CheckoutPricingTaxRule[]
    now?: Date
    currency?: string
  } = {}
): CheckoutPricingResultWithDecisions {
  return withDisplayDollars(buildCheckoutPricingWithDecisionsCents(items, shippingThresholdCents, options))
}

export function buildCheckoutPricing(
  items: CheckoutPricingLine[],
  shippingThresholdCents?: number | null,
  options: {
    discount?: CheckoutPricingDiscount | null
    shippingAddress?: CheckoutPricingAddress
    storeCountry?: string | null
    shippingRates?: CheckoutPricingShippingRates
    shippingZones?: CheckoutPricingShippingZone[]
    taxRates?: CheckoutPricingTaxRates
    taxRules?: CheckoutPricingTaxRule[]
    now?: Date
    currency?: string
  } = {}
): CheckoutPricingResult {
  const detailed = buildCheckoutPricingWithDecisions(items, shippingThresholdCents, options)
  return {
    subtotalCents: detailed.subtotalCents,
    shippingAmountCents: detailed.shippingAmountCents,
    taxAmountCents: detailed.taxAmountCents,
    discountAmountCents: detailed.discountAmountCents,
    totalCents: detailed.totalCents,
    subtotal: detailed.subtotal,
    shippingAmount: detailed.shippingAmount,
    taxAmount: detailed.taxAmount,
    discountAmount: detailed.discountAmount,
    total: detailed.total,
    ...(detailed.appliedDiscount ? { appliedDiscount: detailed.appliedDiscount } : {}),
  }
}
