export type CheckoutPricingLine = {
  price: number
  quantity: number
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

export function roundCurrency(value: number) {
  return Number(value.toFixed(2))
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

export function buildCheckoutPricing(
  items: CheckoutPricingLine[],
  shippingThreshold?: number | null,
  options: {
    discount?: CheckoutPricingDiscount | null
    now?: Date
  } = {}
): CheckoutPricingResult {
  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
  )
  const shippingAmount =
    shippingThreshold != null && subtotal >= shippingThreshold ? 0 : subtotal > 0 ? 9.99 : 0
  const taxAmount = 0
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
