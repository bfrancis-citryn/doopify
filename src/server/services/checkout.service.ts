import { Prisma, type CheckoutSessionStatus } from '@prisma/client'

import { createStripePaymentIntent, type StripePaymentIntent } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { emitInternalEvent } from '@/server/events/dispatcher'
import { buildCheckoutPricing } from '@/server/checkout/pricing'
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
    price: number
    quantity: number
  }>
  shippingAddress: CheckoutAddress
  billingAddress: CheckoutAddress
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
      price: variant.price,
      quantity: item.quantity,
    }
  })
}

async function resolveCheckoutCustomer(payload: CheckoutPayload) {
  let customer = await getCustomerByEmail(payload.email)

  if (!customer) {
    customer = await createCustomer({
      email: payload.email,
      firstName: payload.shippingAddress.firstName,
      lastName: payload.shippingAddress.lastName,
      phone: payload.shippingAddress.phone,
    })
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
}) {
  const store = await getStoreSettings()
  const normalizedEmail = normalizeEmail(input.email)
  const lineItems = await resolveLineItems(input.items)
  const shippingAddress = normalizeAddress(input.shippingAddress)
  const billingAddress = normalizeAddress(input.billingAddress ?? input.shippingAddress)
  const pricing = buildCheckoutPricing(lineItems, store?.shippingThreshold)
  const currency = (store?.currency || 'USD').toUpperCase()
  const customer = await getCustomerByEmail(normalizedEmail)

  const paymentIntent = await createStripePaymentIntent({
    amount: Math.round(pricing.total * 100),
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
  }

  const checkoutSession = await prisma.checkoutSession.create({
    data: {
      paymentIntentId: paymentIntent.id,
      customerId: customer?.id,
      email: normalizedEmail,
      currency,
      subtotal: pricing.subtotal,
      taxAmount: pricing.taxAmount,
      shippingAmount: pricing.shippingAmount,
      discountAmount: pricing.discountAmount,
      total: pricing.total,
      payload: payload as Prisma.InputJsonValue,
    },
  })

  return {
    checkoutSessionId: checkoutSession.id,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    currency,
    ...pricing,
    items: payload.items,
  }
}

export async function completeCheckoutFromPaymentIntent(intent: StripePaymentIntent) {
  const existingOrder = await getOrderByPaymentIntentId(intent.id)
  if (existingOrder) {
    await prisma.checkoutSession.updateMany({
      where: { paymentIntentId: intent.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
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
    taxAmount: checkoutSession.taxAmount,
    shippingAmount: checkoutSession.shippingAmount,
    discountAmount: checkoutSession.discountAmount,
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
  const checkoutSession = await prisma.checkoutSession.findUnique({
    where: { paymentIntentId: input.paymentIntentId },
  })

  if (!checkoutSession) {
    return null
  }

  const updated = await prisma.checkoutSession.update({
    where: { id: checkoutSession.id },
    data: {
      status: 'FAILED',
      failureReason: input.reason ?? 'Payment failed',
    },
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
