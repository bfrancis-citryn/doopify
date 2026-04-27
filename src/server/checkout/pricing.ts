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

export type CheckoutPricingResult = {
  subtotal: number
  shippingAmount: number
  taxAmount: number
  discountAmount: number
  total: number
  appliedDiscount?: CheckoutAppliedDiscount
}

type CheckoutPricingShippingRates = {
  domestic: number
  international: number
}

type CheckoutPricingTaxRule = {
  country: string
  province?: string
  rate: number
}

const DEFAULT_SHIPPING_RATES: CheckoutPricingShippingRates = {
  domestic: 9.99,
  international: 19.99,
}

const DEFAULT_TAX_RULES: CheckoutPricingTaxRule[] = [
  { country: 'US', province: 'CA', rate: 0.0825 },
  { country: 'US', province: 'NY', rate: 0.08875 },
  { country: 'US', rate: 0.07 },
  { country: 'CA', rate: 0.05 },
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

function validateCheckoutDiscount(
  discount: CheckoutPricingDiscount,
  subtotal: number,
  now: Date
) {
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

function calculateShippingAmount(input: {
  subtotal: number
  shippingThreshold?: number | null
  shippingAddress?: CheckoutPricingAddress
  storeCountry?: string | null
  shippingRates: CheckoutPricingShippingRates
}) {
  const { subtotal, shippingThreshold, shippingAddress, storeCountry, shippingRates } = input
  if (subtotal <= 0) {
    return 0
  }

  if (shippingThreshold != null && subtotal >= shippingThreshold) {
    return 0
  }

  const destinationCountry = normalizeCountry(shippingAddress?.country)
  const originCountry = normalizeCountry(storeCountry)
  if (destinationCountry && originCountry && destinationCountry !== originCountry) {
    return roundCurrency(shippingRates.international)
  }

  return roundCurrency(shippingRates.domestic)
}

function resolveTaxRate(input: {
  shippingAddress?: CheckoutPricingAddress
  taxRules: CheckoutPricingTaxRule[]
}) {
  const destinationCountry = normalizeCountry(input.shippingAddress?.country)
  const destinationProvince = normalizeProvince(input.shippingAddress?.province)
  if (!destinationCountry) {
    return 0
  }

  const provinceRule = input.taxRules.find(
    (rule) =>
      normalizeCountry(rule.country) === destinationCountry &&
      normalizeProvince(rule.province) &&
      normalizeProvince(rule.province) === destinationProvince
  )
  if (provinceRule) {
    return provinceRule.rate
  }

  const countryRule = input.taxRules.find(
    (rule) => normalizeCountry(rule.country) === destinationCountry && !normalizeProvince(rule.province)
  )
  return countryRule?.rate ?? 0
}

export function buildCheckoutPricing(
  items: CheckoutPricingLine[],
  shippingThreshold?: number | null,
  options: {
    discount?: CheckoutPricingDiscount | null
    shippingAddress?: CheckoutPricingAddress
    storeCountry?: string | null
    shippingRates?: CheckoutPricingShippingRates
    taxRules?: CheckoutPricingTaxRule[]
    now?: Date
  } = {}
): CheckoutPricingResult {
  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
  )
  const shippingRates = options.shippingRates ?? DEFAULT_SHIPPING_RATES
  const taxRules = options.taxRules ?? DEFAULT_TAX_RULES
  const shippingAmount = calculateShippingAmount({
    subtotal,
    shippingThreshold,
    shippingAddress: options.shippingAddress,
    storeCountry: options.storeCountry,
    shippingRates,
  })
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
  const taxRate = resolveTaxRate({
    shippingAddress: options.shippingAddress,
    taxRules,
  })
  const taxAmount = roundCurrency(taxableSubtotal * taxRate)
  const total = roundCurrency(subtotal + shippingAmount + taxAmount - discountAmount)

  return {
    subtotal,
    shippingAmount,
    taxAmount,
    discountAmount,
    total,
    ...(appliedDiscount ? { appliedDiscount } : {}),
  }
}
