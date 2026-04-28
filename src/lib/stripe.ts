import crypto from 'node:crypto'

import { env } from '@/lib/env'

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

function getStripeSecretKey() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  return env.STRIPE_SECRET_KEY
}

export function getStripePublishableKey() {
  if (!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured')
  }

  return env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
}

async function stripeRequest<T>(
  path: string,
  body: URLSearchParams,
  options: { idempotencyKey?: string } = {}
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getStripeSecretKey()}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey
  }

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store',
  })

  const payload = await response.json()

  if (!response.ok) {
    const message =
      payload?.error?.message || payload?.error?.code || `Stripe request failed with status ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

export async function createStripePaymentIntent(input: {
  amount: number
  currency: string
  email?: string
  metadata?: Record<string, string | undefined>
}) {
  const body = new URLSearchParams()
  body.set('amount', String(input.amount))
  body.set('currency', input.currency.toLowerCase())
  body.set('automatic_payment_methods[enabled]', 'true')
  body.set('automatic_payment_methods[allow_redirects]', 'never')

  if (input.email) {
    body.set('receipt_email', input.email)
  }

  for (const [key, value] of Object.entries(input.metadata ?? {})) {
    if (value) {
      body.set(`metadata[${key}]`, value)
    }
  }

  return stripeRequest<StripePaymentIntent>('/payment_intents', body)
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
}) {
  const body = new URLSearchParams()

  if (input.chargeId) {
    body.set('charge', input.chargeId)
  } else if (input.paymentIntentId) {
    body.set('payment_intent', input.paymentIntentId)
  } else {
    throw new Error('createStripeRefund requires chargeId or paymentIntentId')
  }

  if (input.amount != null) {
    body.set('amount', String(Math.round(input.amount)))
  }

  if (input.reason) {
    body.set('reason', input.reason)
  }

  return stripeRequest<StripeRefund>('/refunds', body, {
    idempotencyKey: input.idempotencyKey,
  })
}

export async function getStripeEvent(eventId: string) {
  const response = await fetch(`https://api.stripe.com/v1/events/${encodeURIComponent(eventId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
    },
    cache: 'no-store',
  })

  const payload = await response.json()
  if (!response.ok) {
    const message =
      payload?.error?.message || payload?.error?.code || `Stripe request failed with status ${response.status}`
    throw new Error(message)
  }

  return payload as StripeWebhookEvent<StripePaymentIntent>
}

function secureCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8')
  const rightBuffer = Buffer.from(right, 'utf8')

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

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

  const pairs = signatureHeader.split(',').map((segment) => segment.trim())
  const timestamp = pairs.find((pair) => pair.startsWith('t='))?.slice(2)
  const signatures = pairs
    .filter((pair) => pair.startsWith('v1='))
    .map((pair) => pair.slice(3))
    .filter(Boolean)

  if (!timestamp || !signatures.length) {
    throw new Error('Malformed Stripe-Signature header')
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (!Number.isFinite(age) || age > toleranceSeconds) {
    throw new Error('Stripe webhook timestamp is outside the allowed tolerance')
  }

  const expectedSignature = crypto
    .createHmac('sha256', endpointSecret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex')

  const matches = signatures.some((signature) => secureCompare(signature, expectedSignature))
  if (!matches) {
    throw new Error('Stripe webhook signature verification failed')
  }
}
