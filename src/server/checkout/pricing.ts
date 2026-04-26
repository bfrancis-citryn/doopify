export type CheckoutPricingLine = {
  price: number
  quantity: number
}

export type CheckoutPricingResult = {
  subtotal: number
  shippingAmount: number
  taxAmount: number
  discountAmount: number
  total: number
}

export function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

export function buildCheckoutPricing(
  items: CheckoutPricingLine[],
  shippingThreshold?: number | null
): CheckoutPricingResult {
  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
  )
  const shippingAmount =
    shippingThreshold != null && subtotal >= shippingThreshold ? 0 : subtotal > 0 ? 9.99 : 0
  const taxAmount = 0
  const discountAmount = 0
  const total = roundCurrency(subtotal + shippingAmount + taxAmount - discountAmount)

  return {
    subtotal,
    shippingAmount,
    taxAmount,
    discountAmount,
    total,
  }
}
