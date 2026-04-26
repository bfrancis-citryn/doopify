import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyStripeWebhookSignature: vi.fn(),
  completeCheckoutFromPaymentIntent: vi.fn(),
  markCheckoutSessionFailed: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  verifyStripeWebhookSignature: mocks.verifyStripeWebhookSignature,
}))

vi.mock('@/server/services/checkout.service', () => ({
  completeCheckoutFromPaymentIntent: mocks.completeCheckoutFromPaymentIntent,
  markCheckoutSessionFailed: mocks.markCheckoutSessionFailed,
}))

import { POST } from './route'

describe('Stripe webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
  })
})
