import Stripe from 'stripe'

import { env } from '@/lib/env'

function normalizeSecretKey(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.trim()
  return normalized || null
}

function resolveStripeSecretKey(secretKeyOverride?: string | null) {
  const override = normalizeSecretKey(secretKeyOverride)
  if (override) return override

  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  return env.STRIPE_SECRET_KEY
}

export function getStripeSdkClient(secretKeyOverride?: string | null) {
  const secretKey = resolveStripeSecretKey(secretKeyOverride)
  return new Stripe(secretKey)
}
