import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyStripeWebhookSignature: vi.fn(),
  completeCheckoutFromPaymentIntent: vi.fn(),
  markCheckoutSessionFailed: vi.fn(),
  recordWebhookDeliveryAttempt: vi.fn(),
  markWebhookDeliveryProcessed: vi.fn(),
  markWebhookDeliveryFailed: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  verifyStripeWebhookSignature: mocks.verifyStripeWebhookSignature,
}))

vi.mock('@/server/services/checkout.service', () => ({
  completeCheckoutFromPaymentIntent: mocks.completeCheckoutFromPaymentIntent,
  markCheckoutSessionFailed: mocks.markCheckoutSessionFailed,
}))

vi.mock('@/server/services/webhook-delivery.service', () => ({
  recordWebhookDeliveryAttempt: mocks.recordWebhookDeliveryAttempt,
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
    expect(mocks.completeCheckoutFromPaymentIntent).not.toHaveBeenCalled()
    expect(mocks.markCheckoutSessionFailed).not.toHaveBeenCalled()
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
    expect(mocks.markWebhookDeliveryProcessed).not.toHaveBeenCalled()
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
    expect(mocks.completeCheckoutFromPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pi_ok' })
    )
    expect(mocks.markWebhookDeliveryProcessed).toHaveBeenCalledWith({
      provider: 'stripe',
      providerEventId: 'evt_test',
    })
    expect(mocks.markWebhookDeliveryFailed).not.toHaveBeenCalled()
  })

  it('records failed delivery status when webhook processing throws', async () => {
    mocks.completeCheckoutFromPaymentIntent.mockRejectedValue(new Error('Order finalization failed'))

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
    })
    expect(mocks.markWebhookDeliveryProcessed).not.toHaveBeenCalled()
  })
})
