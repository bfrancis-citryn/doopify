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
      quantity: item.quantity,
    }
  })
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
}) {
  const store = await getStoreSettings()
  const normalizedEmail = normalizeEmail(input.email)
  const lineItems = await resolveLineItems(input.items)
  const shippingAddress = normalizeAddress(input.shippingAddress)
  const billingAddress = normalizeAddress(input.billingAddress ?? input.shippingAddress)
  const discount = await resolveDiscountCode(input.discountCode)
  const currency = (store?.currency || 'USD').toUpperCase()

  const pricing = buildCheckoutPricingWithDecisionsCents(lineItems, store?.shippingThresholdCents, {
    discount: discount
      ? {
          ...discount,
          minimumOrderCents: discount.minimumOrderCents,
        }
      : null,
    shippingAddress,
    storeCountry: store?.country,
    currency,
    shippingRates: {
      domesticCents: Number(store?.shippingDomesticRateCents ?? 999),
      internationalCents: Number(store?.shippingInternationalRateCents ?? 1999),
    },
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
    ...(store?.country
      ? {
          taxRates: {
            domestic: Number(store?.domesticTaxRate ?? 0.07),
            international: Number(store?.internationalTaxRate ?? 0),
          },
        }
      : {}),
  })

  const customer = await getCustomerByEmail(normalizedEmail)

  const paymentIntent = await createStripePaymentIntent({
    amount: pricing.totalCents ?? 0,
    currency,
    email: normalizedEmail,
    metadata: {
      checkoutEmail: normalizedEmail,
    },
  })

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
      subtotalCents: pricing.subtotalCents ?? 0,
      shippingAmountCents: pricing.shippingAmountCents ?? 0,
      taxAmountCents: pricing.taxAmountCents ?? 0,
      discountAmountCents: pricing.discountAmountCents ?? 0,
      totalCents: pricing.totalCents ?? 0,
      shippingDecision: pricing.shippingDecision,
      taxDecision: pricing.taxDecision,
    },
    ...(pricing.appliedDiscount ? { discountApplications: [pricing.appliedDiscount] } : {}),
  }

  const checkoutSession = await prisma.checkoutSession.create({
    data: {
      paymentIntentId: paymentIntent.id,
      customerId: customer?.id,
      email: normalizedEmail,
      currency,
      subtotalCents: pricing.subtotalCents ?? 0,
      taxAmountCents: pricing.taxAmountCents ?? 0,
      shippingAmountCents: pricing.shippingAmountCents ?? 0,
      discountAmountCents: pricing.discountAmountCents ?? 0,
      totalCents: pricing.totalCents ?? 0,
      payload: payload as Prisma.InputJsonValue,
    },
  })

  await emitInternalEvent('checkout.created', {
    checkoutSessionId: checkoutSession.id,
    paymentIntentId: paymentIntent.id,
    email: normalizedEmail,
    total: centsToDollars(pricing.totalCents ?? 0),
    currency,
  })

  return {
    checkoutSessionId: checkoutSession.id,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    currency,
    ...mapCheckoutPricingForPresentation(pricing),
    items: payload.items.map((item) => ({
      ...item,
      price: centsToDollars(item.priceCents ?? 0),
    })),
    appliedDiscount: pricing.appliedDiscount
      ? {
        ...pricing.appliedDiscount,
          amount: centsToDollars(
            pricing.appliedDiscount.amountCents ??
              dollarsToCents((pricing.appliedDiscount as { amount?: number }).amount ?? 0)
          ),
        }
      : undefined,
  }
}

export async function completeCheckoutFromPaymentIntent(intent: StripePaymentIntent) {
  const existingOrder = await getOrderByPaymentIntentId(intent.id)
  if (existingOrder) {
    await prisma.checkoutSession.updateMany({
      where: { paymentIntentId: intent.id },
      data: { status: 'COMPLETED', completedAt: new Date(), failureReason: null },
    })
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

  const order = await createOrder({
    customerId: customer?.id,
    email: payload.email,
    items: payload.items,
    shippingAddress: payload.shippingAddress,
    billingAddress: payload.billingAddress,
    discountApplications: payload.discountApplications,
    taxAmountCents: checkoutSession.taxAmountCents,
    shippingAmountCents: checkoutSession.shippingAmountCents,
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
