import { Stripe } from 'stripe'

import { env } from '@/lib/env'
import { getStripeSdkClient } from '@/lib/stripe-client'

export type StripePaymentIntent = {
  id: string
  client_secret?: string | null
  amount: number
  currency: string
  latest_charge?: string | { id: string } | null
  status: string
  metadata?: Record<string, string>
  last_payment_error?: {
    message?: string | null
  } | null
}

export type StripeWebhookEvent<T = unknown> = {
  id: string
  type: string
  data: {
    object: T
  }
}

export function getStripePublishableKey() {
  if (!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured')
  }

  return env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
}

export async function createStripePaymentIntent(input: {
  amount: number
  currency: string
  email?: string
  metadata?: Record<string, string | undefined>
  secretKey?: string | null
}) {
  const stripeClient = getStripeSdkClient(input.secretKey)
  const metadata = Object.fromEntries(
    Object.entries(input.metadata ?? {}).filter(([, value]) => Boolean(value))
  ) as Record<string, string>

  try {
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      ...(input.email ? { receipt_email: input.email } : {}),
      ...(Object.keys(metadata).length ? { metadata } : {}),
    })

    return {
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      latest_charge:
        typeof paymentIntent.latest_charge === 'string' || paymentIntent.latest_charge == null
          ? paymentIntent.latest_charge
          : { id: paymentIntent.latest_charge.id },
      status: paymentIntent.status,
      metadata: paymentIntent.metadata as Record<string, string>,
      last_payment_error: paymentIntent.last_payment_error
        ? {
            message: paymentIntent.last_payment_error.message,
          }
        : null,
    } satisfies StripePaymentIntent
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe request failed'
    throw new Error(message)
  }
}

export type StripeRefund = {
  id: string
  amount: number
  currency: string
  status: string
  charge?: string | null
  payment_intent?: string | null
  reason?: string | null
}

export async function createStripeRefund(input: {
  chargeId?: string | null
  paymentIntentId?: string | null
  amount?: number
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  idempotencyKey?: string
  secretKey?: string | null
}) {
  const stripeClient = getStripeSdkClient(input.secretKey)
  const createPayload: {
    charge?: string
    payment_intent?: string
    amount?: number
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  } = {}

  if (input.chargeId) {
    createPayload.charge = input.chargeId
  } else if (input.paymentIntentId) {
    createPayload.payment_intent = input.paymentIntentId
  } else {
    throw new Error('createStripeRefund requires chargeId or paymentIntentId')
  }

  if (input.amount != null) {
    createPayload.amount = Math.round(input.amount)
  }

  if (input.reason) {
    createPayload.reason = input.reason
  }

  try {
    const refund = await stripeClient.refunds.create(
      createPayload,
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
    )

    return {
      id: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status ?? 'unknown',
      charge: typeof refund.charge === 'string' ? refund.charge : refund.charge?.id ?? null,
      payment_intent:
        typeof refund.payment_intent === 'string'
          ? refund.payment_intent
          : refund.payment_intent?.id ?? null,
      reason: refund.reason,
    } satisfies StripeRefund
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe request failed'
    throw new Error(message)
  }
}

export async function getStripeEvent(eventId: string, secretKey?: string | null) {
  const stripeClient = getStripeSdkClient(secretKey)
  try {
    const event = await stripeClient.events.retrieve(eventId)
    return event as StripeWebhookEvent<StripePaymentIntent>
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe request failed'
    throw new Error(message)
  }
}

const webhookVerificationClient: Stripe = getStripeSdkClient('sk_test_webhook_signature_only')

export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  endpointSecret = env.STRIPE_WEBHOOK_SECRET,
  toleranceSeconds = 300
) {
  if (!endpointSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }

  if (!signatureHeader) {
    throw new Error('Missing Stripe-Signature header')
  }

  try {
    webhookVerificationClient.webhooks.constructEvent(
      payload,
      signatureHeader,
      endpointSecret,
      toleranceSeconds
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook signature verification failed'

    if (
      message.includes('Unable to extract timestamp and signatures from header') ||
      message.includes('No signatures found with expected scheme')
    ) {
      throw new Error('Malformed Stripe-Signature header')
    }

    if (message.includes('Timestamp outside the tolerance zone')) {
      throw new Error('Stripe webhook timestamp is outside the allowed tolerance')
    }

    if (message.includes('No signatures found matching the expected signature for payload')) {
      throw new Error('Stripe webhook signature verification failed')
    }

    throw error
  }
}
