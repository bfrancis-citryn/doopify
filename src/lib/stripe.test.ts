import crypto from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { verifyStripeWebhookSignature } from './stripe'

function signPayload(payload: string, secret: string, timestamp: number) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex')
}

describe('verifyStripeWebhookSignature', () => {
  it('rejects a payload whose signature does not match', () => {
    const payload = JSON.stringify({ id: 'evt_test' })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = signPayload(payload, 'wrong-secret', timestamp)

    expect(() =>
      verifyStripeWebhookSignature(payload, `t=${timestamp},v1=${signature}`, 'right-secret')
    ).toThrow('Stripe webhook signature verification failed')
  })
})
