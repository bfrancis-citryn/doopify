import { Prisma, type CheckoutSessionStatus } from '@prisma/client'

import { centsToDollars, dollarsToCents } from '@/lib/money'
import { prisma } from '@/lib/prisma'
import { createStripePaymentIntent, type StripePaymentIntent } from '@/lib/stripe'
import {
  buildCheckoutPricingWithDecisionsCents,
  type CheckoutAppliedDiscount,
  type CheckoutPricingShippingDecision,
  type CheckoutPricingTaxDecision,
} from '@/server/checkout/pricing'
import { emitInternalEvent } from '@/server/events/dispatcher'
import { getStripeRuntimeConnection } from '@/server/payments/stripe-runtime.service'
import {
  getShippingRatesForCheckout,
} from '@/server/shipping/shipping-rate.service'
import type { ShippingRateQuote } from '@/server/shipping/shipping-rate.types'
import { markCheckoutRecoveredByPaymentIntent } from '@/server/services/abandoned-checkout.service'
import { addCustomerAddress, createCustomer, getCustomerByEmail } from '@/server/services/customer.service'
import { createOrder, getOrderByPaymentIntentId } from '@/server/services/order.service'
import { getStoreSettings } from '@/server/services/settings.service'

type CheckoutAddress = {
  firstName?: string
  lastName?: string
  company?: string
  address1: string
  address2?: string
  city: string
  province?: string
  postalCode: string
  country: string
  phone?: string
}

type CheckoutItemInput = {
  variantId: string
  quantity: number
}

type CheckoutPayload = {
  email: string
  items: Array<{
    productId: string
    variantId: string
    title: string
    variantTitle?: string
    sku?: string
    priceCents: number
    quantity: number
  }>
  shippingAddress: CheckoutAddress
  billingAddress: CheckoutAddress
  discountApplications?: CheckoutAppliedDiscount[]
  pricingSnapshot?: {
    computedAt: string
    currency: string
    subtotalCents: number
    shippingAmountCents: number
    taxAmountCents: number
    discountAmountCents: number
    totalCents: number
    shippingDecision: CheckoutPricingShippingDecision
    taxDecision: CheckoutPricingTaxDecision
  }
  selectedShippingRate?: {
    id: string
    source: 'MANUAL' | 'EASYPOST' | 'SHIPPO'
    rateType?: 'LIVE_RATE' | 'FALLBACK' | 'FLAT' | 'FREE' | 'WEIGHT_BASED' | 'PRICE_BASED'
    carrier?: string
    service?: string
    displayName: string
    amountCents: number
    currency: string
    estimatedDays?: number
    estimatedDeliveryText?: string
    providerRateId?: string
  }
}

function allowCheckoutFallbackDefaults() {
  return process.env.NODE_ENV !== 'production' || process.env.CHECKOUT_ALLOW_DEV_FALLBACKS === 'true'
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeAddress(input: CheckoutAddress): CheckoutAddress {
  return {
    firstName: input.firstName?.trim() || undefined,
    lastName: input.lastName?.trim() || undefined,
    company: input.company?.trim() || undefined,
    address1: input.address1.trim(),
    address2: input.address2?.trim() || undefined,
    city: input.city.trim(),
    province: input.province?.trim() || undefined,
    postalCode: input.postalCode.trim(),
    country: input.country.trim(),
    phone: input.phone?.trim() || undefined,
  }
}

function getLatestChargeId(intent: StripePaymentIntent) {
  if (!intent.latest_charge) return undefined
  return typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge.id
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function mapCheckoutPricingForPresentation(pricing: {
  subtotalCents?: number
  shippingAmountCents?: number
  taxAmountCents?: number
  discountAmountCents?: number
  totalCents?: number
  subtotal?: number
  shippingAmount?: number
  taxAmount?: number
  discountAmount?: number
  total?: number
}) {
  const subtotalCents = pricing.subtotalCents ?? dollarsToCents(pricing.subtotal ?? 0)
  const shippingAmountCents =
    pricing.shippingAmountCents ?? dollarsToCents(pricing.shippingAmount ?? 0)
  const taxAmountCents = pricing.taxAmountCents ?? dollarsToCents(pricing.taxAmount ?? 0)
  const discountAmountCents =
    pricing.discountAmountCents ?? dollarsToCents(pricing.discountAmount ?? 0)
  const totalCents = pricing.totalCents ?? dollarsToCents(pricing.total ?? 0)

  return {
    subtotal: centsToDollars(subtotalCents),
    shippingAmount: centsToDollars(shippingAmountCents),
    taxAmount: centsToDollars(taxAmountCents),
    discountAmount: centsToDollars(discountAmountCents),
    total: centsToDollars(totalCents),
    subtotalCents,
    shippingAmountCents,
    taxAmountCents,
    discountAmountCents,
    totalCents,
  }
}

function mapShippingQuoteForSnapshot(quote: ShippingRateQuote) {
  return {
    id: quote.id,
    source: quote.source,
    rateType: quote.rateType,
    carrier: quote.carrier,
    service: quote.service,
    displayName: quote.displayName,
    amountCents: quote.amountCents,
    currency: quote.currency,
    estimatedDays: quote.estimatedDays,
    estimatedDeliveryText: quote.estimatedDeliveryText,
    providerRateId: quote.providerRateId,
  }
}

function convertVariantWeightToOz(weight: number | null | undefined, unit: string | null | undefined) {
  if (!Number.isFinite(weight) || Number(weight) <= 0) return 0

  const normalizedUnit = String(unit || 'oz').trim().toLowerCase()
  const normalizedWeight = Number(weight)

  if (normalizedUnit === 'lb' || normalizedUnit === 'lbs' || normalizedUnit === 'pound') {
    return normalizedWeight * 16
  }

  if (normalizedUnit === 'g' || normalizedUnit === 'gram') {
    return normalizedWeight * 0.0352739619
  }

  if (normalizedUnit === 'kg' || normalizedUnit === 'kilogram') {
    return normalizedWeight * 35.2739619
  }

  return normalizedWeight
}

async function resolveLineItems(items: CheckoutItemInput[]) {
  const uniqueVariantIds = Array.from(new Set(items.map((item) => item.variantId)))

  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: uniqueVariantIds },
      product: { status: 'ACTIVE' },
    },
    include: {
      product: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  })

  const variantMap = new Map(variants.map((variant) => [variant.id, variant]))

  return items.map((item) => {
    const variant = variantMap.get(item.variantId)
    if (!variant) {
      throw new Error(`Variant ${item.variantId} could not be found`)
    }

    if (variant.inventory < item.quantity) {
      throw new Error(`Only ${variant.inventory} units left for ${variant.product.title}`)
    }

    return {
      productId: variant.productId,
      variantId: variant.id,
      title: variant.product.title,
      variantTitle: variant.title,
      sku: variant.sku ?? undefined,
      priceCents: variant.priceCents ?? dollarsToCents((variant as { price?: number }).price ?? 0),
      weightOz: convertVariantWeightToOz(variant.weight, variant.weightUnit),
      quantity: item.quantity,
    }
  })
}

function toShippingRateAddress(address: CheckoutAddress) {
  return {
    name: [address.firstName, address.lastName].filter(Boolean).join(' ').trim() || null,
    phone: address.phone ?? null,
    address1: address.address1,
    address2: address.address2 ?? null,
    city: address.city,
    province: address.province ?? null,
    postalCode: address.postalCode,
    country: address.country,
  }
}

function subtotalFromLineItems(lineItems: Array<{ priceCents: number; quantity: number }>) {
  return lineItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
}

async function resolveSelectedShippingQuote(input: {
  storeId?: string
  lineItems: Array<{ priceCents: number; weightOz?: number; quantity: number }>
  shippingAddress: CheckoutAddress
  selectedShippingQuoteId?: string
}) {
  const totalWeightOz = input.lineItems.reduce(
    (sum, item) => sum + Number(item.weightOz || 0) * Number(item.quantity || 0),
    0
  )

  const quotes = await getShippingRatesForCheckout({
    storeId: input.storeId,
    subtotalCents: subtotalFromLineItems(input.lineItems),
    totalWeightOz,
    shippingAddress: toShippingRateAddress(input.shippingAddress),
  })

  if (!quotes.length) {
    throw new Error('No shipping rates are available for this checkout')
  }

  const selectedQuote = input.selectedShippingQuoteId
    ? quotes.find((quote) => quote.id === input.selectedShippingQuoteId)
    : quotes[0]

  if (!selectedQuote) {
    throw new Error('Selected shipping option is no longer available. Please refresh shipping options and try again.')
  }

  return {
    selectedQuote,
    quotes,
  }
}

async function resolveDiscountCode(discountCode?: string) {
  const code = discountCode?.trim().toUpperCase()
  if (!code) {
    return null
  }

  const discount = await prisma.discount.findUnique({
    where: { code },
  })

  if (!discount) {
    throw new Error('Discount code not found')
  }

  return discount
}

async function resolveCheckoutCustomer(payload: CheckoutPayload) {
  let customer = await getCustomerByEmail(payload.email)

  if (!customer) {
    try {
      customer = await createCustomer({
        email: payload.email,
        firstName: payload.shippingAddress.firstName,
        lastName: payload.shippingAddress.lastName,
        phone: payload.shippingAddress.phone,
      })
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error
      }

      customer = await getCustomerByEmail(payload.email)
      if (!customer) {
        throw error
      }
    }
  }

  if (customer && customer.addresses.length === 0) {
    await addCustomerAddress(customer.id, {
      firstName: payload.shippingAddress.firstName,
      lastName: payload.shippingAddress.lastName,
      company: payload.shippingAddress.company,
      address1: payload.shippingAddress.address1,
      address2: payload.shippingAddress.address2,
      city: payload.shippingAddress.city,
      province: payload.shippingAddress.province,
      postalCode: payload.shippingAddress.postalCode,
      country: payload.shippingAddress.country,
      phone: payload.shippingAddress.phone,
      isDefault: true,
    })
  }

  return customer
}

export async function createCheckoutPaymentIntent(input: {
  email: string
  items: CheckoutItemInput[]
  shippingAddress: CheckoutAddress
  billingAddress?: CheckoutAddress
  discountCode?: string
  selectedShippingQuoteId?: string
}) {
  const store = await getStoreSettings()
  const normalizedEmail = normalizeEmail(input.email)
  const lineItems = await resolveLineItems(input.items)
  const shippingAddress = normalizeAddress(input.shippingAddress)
  const billingAddress = normalizeAddress(input.billingAddress ?? input.shippingAddress)
  const discount = await resolveDiscountCode(input.discountCode)
  const currency = (store?.currency || 'USD').toUpperCase()
  const shippingResolution = await resolveSelectedShippingQuote({
    storeId: store?.id,
    lineItems,
    shippingAddress,
    selectedShippingQuoteId: input.selectedShippingQuoteId,
  })

  const allowFallbacks = allowCheckoutFallbackDefaults()
  const pricingOptions = {
    discount: discount
      ? {
          ...discount,
          minimumOrderCents: discount.minimumOrderCents,
        }
      : null,
    shippingAddress,
    storeCountry: store?.country,
    currency,
    ...(allowFallbacks
      ? {
          shippingRates: {
            domesticCents: Number(store?.shippingDomesticRateCents ?? 999),
            internationalCents: Number(store?.shippingInternationalRateCents ?? 1999),
          },
        }
      : {}),
    shippingZones: store?.shippingZones?.map((zone) => ({
      id: zone.id,
      name: zone.name,
      countryCode: zone.countryCode,
      provinceCode: zone.provinceCode,
      isActive: zone.isActive,
      priority: zone.priority,
      rates: zone.rates.map((rate) => ({
        id: rate.id,
        name: rate.name,
        method: rate.method,
        amountCents: rate.amountCents,
        minSubtotalCents: rate.minSubtotalCents,
        maxSubtotalCents: rate.maxSubtotalCents,
        isActive: rate.isActive,
        priority: rate.priority,
      })),
    })),
    taxRules: store?.taxRules?.map((rule) => ({
      id: rule.id,
      name: rule.name,
      countryCode: rule.countryCode,
      provinceCode: rule.provinceCode,
      rate: rule.rate,
      isActive: rule.isActive,
      priority: rule.priority,
    })),
    taxSettings: {
      enabled: store?.taxEnabled,
      strategy: store?.taxStrategy,
      defaultTaxRateBps: store?.defaultTaxRateBps,
      taxShipping: store?.taxShipping,
      pricesIncludeTax: store?.pricesIncludeTax,
    },
    ...(allowFallbacks && store?.country
      ? {
          taxRates: {
            domestic: Number(store?.domesticTaxRate ?? 0.07),
            international: Number(store?.internationalTaxRate ?? 0),
          },
        }
      : {}),
  }
  const pricing = buildCheckoutPricingWithDecisionsCents(
    lineItems,
    store?.shippingThresholdCents,
    pricingOptions
  )
  const selectedShippingRate = mapShippingQuoteForSnapshot(shippingResolution.selectedQuote)
  const pricingWithSelectedShipping = buildCheckoutPricingWithDecisionsCents(
    lineItems,
    store?.shippingThresholdCents,
    {
      ...pricingOptions,
      selectedShippingAmountCents: selectedShippingRate.amountCents,
      selectedShippingRateId: selectedShippingRate.id,
    }
  )
  const shippingAmountCents = pricingWithSelectedShipping.shippingAmountCents
  const discountAmountCents = pricingWithSelectedShipping.discountAmountCents ?? 0
  const taxAmountCents = pricingWithSelectedShipping.taxAmountCents ?? 0
  const totalCents = pricingWithSelectedShipping.totalCents
  const appliedDiscount = pricingWithSelectedShipping.appliedDiscount
    ? {
        ...pricingWithSelectedShipping.appliedDiscount,
        amountCents: discountAmountCents,
      }
    : null

  const customer = await getCustomerByEmail(normalizedEmail)
  const stripeRuntime = await getStripeRuntimeConnection()
  if (!stripeRuntime.secretKey) {
    throw new Error(
      'Stripe checkout is not configured. Save and verify Stripe credentials in Settings -> Payments or set STRIPE_SECRET_KEY.'
    )
  }

  console.info(
    `[checkout] Stripe runtime source: ${stripeRuntime.source}; mode: ${stripeRuntime.mode ?? 'unknown'}`
  )

  let paymentIntent: StripePaymentIntent
  try {
    paymentIntent = await createStripePaymentIntent({
      amount: totalCents,
      currency,
      email: normalizedEmail,
      metadata: {
        checkoutEmail: normalizedEmail,
      },
      secretKey: stripeRuntime.secretKey,
    })
  } catch (stripeError) {
    const msg = stripeError instanceof Error ? stripeError.message : String(stripeError)
    if (msg.toLowerCase().includes('invalid api key') || msg.toLowerCase().includes('no such api key')) {
      throw new Error(
        `Stripe rejected the API key (source: ${stripeRuntime.source}, mode: ${stripeRuntime.mode ?? 'unknown'}). ` +
        'Verify the secret key in Settings → Payments and re-save to update.'
      )
    }
    throw stripeError
  }

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return a client secret for this payment intent')
  }

  const payload: CheckoutPayload = {
    email: normalizedEmail,
    items: lineItems,
    shippingAddress,
    billingAddress,
    pricingSnapshot: {
      computedAt: new Date().toISOString(),
      currency,
      subtotalCents: pricingWithSelectedShipping.subtotalCents ?? 0,
      shippingAmountCents,
      taxAmountCents,
      discountAmountCents,
      totalCents,
      shippingDecision: pricingWithSelectedShipping.shippingDecision,
      taxDecision: pricingWithSelectedShipping.taxDecision,
    },
    selectedShippingRate,
    ...(appliedDiscount ? { discountApplications: [appliedDiscount] } : {}),
  }

  const checkoutSession = await prisma.checkoutSession.create({
    data: {
      paymentIntentId: paymentIntent.id,
      customerId: customer?.id,
      email: normalizedEmail,
      currency,
      subtotalCents: pricingWithSelectedShipping.subtotalCents ?? 0,
      taxAmountCents,
      shippingAmountCents,
      discountAmountCents,
      totalCents,
      payload: payload as Prisma.InputJsonValue,
    },
  })

  await emitInternalEvent('checkout.created', {
    checkoutSessionId: checkoutSession.id,
    paymentIntentId: paymentIntent.id,
    email: normalizedEmail,
    total: centsToDollars(totalCents),
    currency,
  })

  return {
    checkoutSessionId: checkoutSession.id,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    currency,
    ...mapCheckoutPricingForPresentation(pricingWithSelectedShipping),
    shippingAmountCents,
    discountAmountCents,
    totalCents,
    shippingAmount: centsToDollars(shippingAmountCents),
    discountAmount: centsToDollars(discountAmountCents),
    total: centsToDollars(totalCents),
    availableShippingRates: shippingResolution.quotes.map(mapShippingQuoteForSnapshot),
    selectedShippingRate,
    items: payload.items.map((item) => ({
      ...item,
      price: centsToDollars(item.priceCents ?? 0),
    })),
    appliedDiscount: appliedDiscount
      ? {
        ...appliedDiscount,
          amount: centsToDollars(
            appliedDiscount.amountCents ??
              dollarsToCents((appliedDiscount as { amount?: number }).amount ?? 0)
          ),
        }
      : undefined,
  }
}

export async function getCheckoutShippingRates(input: {
  items: CheckoutItemInput[]
  shippingAddress: CheckoutAddress
}) {
  const store = await getStoreSettings()
  const lineItems = await resolveLineItems(input.items)
  const shippingAddress = normalizeAddress(input.shippingAddress)
  const totalWeightOz = lineItems.reduce(
    (sum, item) => sum + Number((item as { weightOz?: number }).weightOz || 0) * Number(item.quantity || 0),
    0
  )

  const quotes = await getShippingRatesForCheckout({
    storeId: store?.id,
    subtotalCents: subtotalFromLineItems(lineItems),
    totalWeightOz,
    shippingAddress: toShippingRateAddress(shippingAddress),
  })

  return {
    currency: (store?.currency || 'USD').toUpperCase(),
    quotes: quotes.map((quote) => ({
      ...mapShippingQuoteForSnapshot(quote),
      amount: centsToDollars(quote.amountCents),
    })),
  }
}

export async function completeCheckoutFromPaymentIntent(intent: StripePaymentIntent) {
  const existingOrder = await getOrderByPaymentIntentId(intent.id)
  if (existingOrder) {
    await prisma.checkoutSession.updateMany({
      where: { paymentIntentId: intent.id },
      data: { status: 'COMPLETED', completedAt: new Date(), failureReason: null },
    })
    await markCheckoutRecoveredByPaymentIntent(intent.id)
    return existingOrder
  }

  const checkoutSession = await prisma.checkoutSession.findUnique({
    where: { paymentIntentId: intent.id },
  })

  if (!checkoutSession) {
    throw new Error(`Checkout session not found for payment intent ${intent.id}`)
  }

  const payload = checkoutSession.payload as unknown as CheckoutPayload
  const customer = await resolveCheckoutCustomer(payload)
  const selectedShippingRate = payload.selectedShippingRate

  const order = await createOrder({
    customerId: customer?.id,
    email: payload.email,
    items: payload.items,
    shippingAddress: payload.shippingAddress,
    billingAddress: payload.billingAddress,
    discountApplications: payload.discountApplications,
    taxAmountCents: checkoutSession.taxAmountCents,
    shippingAmountCents: checkoutSession.shippingAmountCents,
    shippingMethodName: selectedShippingRate?.displayName,
    shippingRateType:
      selectedShippingRate?.rateType ??
      (selectedShippingRate?.source === 'MANUAL' ? 'MANUAL' : selectedShippingRate?.source ?? null),
    shippingProvider:
      selectedShippingRate?.source && selectedShippingRate.source !== 'MANUAL'
        ? selectedShippingRate.source
        : null,
    shippingProviderRateId: selectedShippingRate?.providerRateId ?? null,
    estimatedDeliveryText:
      selectedShippingRate?.estimatedDeliveryText ??
      (Number.isFinite(selectedShippingRate?.estimatedDays)
        ? `${selectedShippingRate?.estimatedDays} business day${selectedShippingRate?.estimatedDays === 1 ? '' : 's'}`
        : null),
    discountAmountCents: checkoutSession.discountAmountCents,
    currency: checkoutSession.currency,
    stripePaymentIntentId: intent.id,
    stripeChargeId: getLatestChargeId(intent),
    paymentStatus: 'PAID',
  })

  await prisma.checkoutSession.update({
    where: { id: checkoutSession.id },
    data: {
      customerId: customer?.id,
      status: 'COMPLETED',
      completedAt: new Date(),
      failureReason: null,
    },
  })
  await markCheckoutRecoveredByPaymentIntent(intent.id)

  return order
}

export async function markCheckoutSessionFailed(input: {
  paymentIntentId: string
  reason?: string | null
}) {
  const existingOrder = await getOrderByPaymentIntentId(input.paymentIntentId)
  if (existingOrder) {
    return null
  }

  const checkoutSession = await prisma.checkoutSession.findUnique({
    where: { paymentIntentId: input.paymentIntentId },
  })

  if (!checkoutSession) {
    return null
  }

  const updateResult = await prisma.checkoutSession.updateMany({
    where: {
      id: checkoutSession.id,
      status: 'PENDING',
    },
    data: {
      status: 'FAILED',
      failureReason: input.reason ?? 'Payment failed',
    },
  })

  if (updateResult.count === 0) {
    return prisma.checkoutSession.findUnique({
      where: { id: checkoutSession.id },
    })
  }

  const updated = await prisma.checkoutSession.findUniqueOrThrow({
    where: { id: checkoutSession.id },
  })

  await emitInternalEvent('checkout.failed', {
    paymentIntentId: input.paymentIntentId,
    email: updated.email,
    reason: updated.failureReason,
  })

  return updated
}

export async function getCheckoutStatus(paymentIntentId: string): Promise<{
  status: 'processing' | 'paid' | 'failed'
  orderNumber?: number
  reason?: string | null
  checkoutStatus?: CheckoutSessionStatus
}> {
  const existingOrder = await getOrderByPaymentIntentId(paymentIntentId)
  if (existingOrder) {
    return {
      status: 'paid',
      orderNumber: existingOrder.orderNumber,
      checkoutStatus: 'COMPLETED',
    }
  }

  const checkoutSession = await prisma.checkoutSession.findUnique({
    where: { paymentIntentId },
    select: {
      status: true,
      failureReason: true,
    },
  })

  if (!checkoutSession) {
    return { status: 'processing' }
  }

  if (checkoutSession.status === 'FAILED') {
    return {
      status: 'failed',
      reason: checkoutSession.failureReason,
      checkoutStatus: checkoutSession.status,
    }
  }

  return {
    status: 'processing',
    checkoutStatus: checkoutSession.status,
  }
}
