import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyStripeWebhookSignature: vi.fn(),
  processStripeWebhookEvent: vi.fn(),
  recordWebhookDeliveryAttempt: vi.fn(),
  storeVerifiedWebhookPayload: vi.fn(),
  markWebhookDeliveryProcessed: vi.fn(),
  markWebhookDeliveryFailed: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  verifyStripeWebhookSignature: mocks.verifyStripeWebhookSignature,
}))

vi.mock('@/server/services/stripe-webhook.service', () => ({
  parseStripeWebhookEventPayload: (payload: string) => {
    try {
      const event = JSON.parse(payload)
      if (!event || typeof event !== 'object') return null
      if (typeof event.id !== 'string' || typeof event.type !== 'string') return null
      if (!event.data || typeof event.data !== 'object' || !('object' in event.data)) return null
      return event
    } catch {
      return null
    }
  },
  processStripeWebhookEvent: mocks.processStripeWebhookEvent,
}))

vi.mock('@/server/services/webhook-delivery.service', () => ({
  recordWebhookDeliveryAttempt: mocks.recordWebhookDeliveryAttempt,
  storeVerifiedWebhookPayload: mocks.storeVerifiedWebhookPayload,
  markWebhookDeliveryProcessed: mocks.markWebhookDeliveryProcessed,
  markWebhookDeliveryFailed: mocks.markWebhookDeliveryFailed,
}))

import { POST } from './route'

describe('Stripe webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyStripeWebhookSignature.mockImplementation(() => undefined)
    mocks.recordWebhookDeliveryAttempt.mockResolvedValue({
      provider: 'stripe',
      providerEventId: 'evt_test',
    })
  })

  it('rejects invalid webhook signatures before processing the event', async () => {
    mocks.verifyStripeWebhookSignature.mockImplementation(() => {
      throw new Error('Stripe webhook signature verification failed')
    })

    const response = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'bad-signature',
        },
        body: JSON.stringify({
          id: 'evt_bad',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_bad',
            },
          },
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Stripe webhook signature verification failed')
    expect(mocks.processStripeWebhookEvent).not.toHaveBeenCalled()
    expect(mocks.recordWebhookDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'stripe',
        providerEventId: 'evt_bad',
        eventType: 'payment_intent.succeeded',
      })
    )
    expect(mocks.markWebhookDeliveryFailed).toHaveBeenCalledWith({
      provider: 'stripe',
      providerEventId: 'evt_test',
      status: 'SIGNATURE_FAILED',
      error: 'Stripe webhook signature verification failed',
    })
    expect(mocks.storeVerifiedWebhookPayload).not.toHaveBeenCalled()
    expect(mocks.markWebhookDeliveryProcessed).not.toHaveBeenCalled()
  })

  it('rejects malformed payloads without storing a verified payload or scheduling retry', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'good-signature',
        },
        body: '{"not":"stripe"}',
      })
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Invalid Stripe webhook payload')
    expect(mocks.storeVerifiedWebhookPayload).not.toHaveBeenCalled()
    expect(mocks.markWebhookDeliveryFailed).toHaveBeenCalledWith({
      provider: 'stripe',
      providerEventId: 'evt_test',
      error: 'Invalid Stripe webhook payload',
      retryable: false,
    })
  })

  it('records processed payment_intent.succeeded events', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'good-signature',
        },
        body: JSON.stringify({
          id: 'evt_ok',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_ok',
              amount: 5999,
              currency: 'usd',
              status: 'succeeded',
            },
          },
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.processStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt_ok',
        type: 'payment_intent.succeeded',
      })
    )
    expect(mocks.storeVerifiedWebhookPayload).toHaveBeenCalledWith({
      provider: 'stripe',
      providerEventId: 'evt_test',
      rawPayload: expect.stringContaining('"evt_ok"'),
    })
    expect(mocks.markWebhookDeliveryProcessed).toHaveBeenCalledWith({
      provider: 'stripe',
      providerEventId: 'evt_test',
    })
    expect(mocks.markWebhookDeliveryFailed).not.toHaveBeenCalled()
  })

  it('records failed delivery status when webhook processing throws', async () => {
    mocks.processStripeWebhookEvent.mockRejectedValue(new Error('Order finalization failed'))

    const response = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'good-signature',
        },
        body: JSON.stringify({
          id: 'evt_fail',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_fail',
              amount: 5999,
              currency: 'usd',
              status: 'succeeded',
            },
          },
        }),
      })
    )

    expect(response.status).toBe(500)
    expect(await response.text()).toBe('Webhook processing failed')
    expect(mocks.markWebhookDeliveryFailed).toHaveBeenCalledWith({
      provider: 'stripe',
      providerEventId: 'evt_test',
      error: 'Order finalization failed',
      retryable: true,
    })
    expect(mocks.markWebhookDeliveryProcessed).not.toHaveBeenCalled()
  })
})
