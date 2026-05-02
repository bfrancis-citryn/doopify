import { describe, expect, it } from 'vitest'
import Stripe from 'stripe'

import { verifyStripeWebhookSignature } from './stripe'

const sdkTestClient = new Stripe('sk_test_webhook_test_helper')

function generateSignedHeader(payload: string, secret: string, timestamp?: number) {
  return sdkTestClient.webhooks.generateTestHeaderString({
    payload,
    secret,
    ...(timestamp ? { timestamp } : {}),
  })
}

describe('verifyStripeWebhookSignature', () => {
  it('accepts a valid Stripe signature', () => {
    const payload = JSON.stringify({ id: 'evt_valid' })
    const secret = 'whsec_valid_secret'
    const signature = generateSignedHeader(payload, secret)

    expect(() => verifyStripeWebhookSignature(payload, signature, secret)).not.toThrow()
  })

  it('rejects when the Stripe-Signature header is missing', () => {
    const payload = JSON.stringify({ id: 'evt_missing_header' })

    expect(() => verifyStripeWebhookSignature(payload, null, 'whsec_secret')).toThrow(
      'Missing Stripe-Signature header'
    )
  })

  it('rejects malformed Stripe-Signature headers', () => {
    const payload = JSON.stringify({ id: 'evt_malformed' })

    expect(() => verifyStripeWebhookSignature(payload, 'not-a-valid-header', 'whsec_secret')).toThrow(
      'Malformed Stripe-Signature header'
    )
  })

  it('rejects signatures outside the allowed timestamp tolerance', () => {
    const payload = JSON.stringify({ id: 'evt_old' })
    const secret = 'whsec_old_secret'
    const timestamp = Math.floor(Date.now() / 1000) - 1200
    const signature = generateSignedHeader(payload, secret, timestamp)

    expect(() => verifyStripeWebhookSignature(payload, signature, secret, 300)).toThrow(
      'Stripe webhook timestamp is outside the allowed tolerance'
    )
  })

  it('rejects a payload whose signature does not match', () => {
    const payload = JSON.stringify({ id: 'evt_wrong_secret' })
    const signature = generateSignedHeader(payload, 'whsec_wrong_secret')

    expect(() =>
      verifyStripeWebhookSignature(payload, signature, 'whsec_right_secret')
    ).toThrow('Stripe webhook signature verification failed')
  })
})
