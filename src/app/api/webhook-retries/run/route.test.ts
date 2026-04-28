import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  claimWebhookDeliveryForRetry: vi.fn(),
  getDueWebhookDeliveriesForRetry: vi.fn(),
  markWebhookDeliveryProcessed: vi.fn(),
  markWebhookDeliveryFailed: vi.fn(),
  processStripeWebhookEvent: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  env: {
    WEBHOOK_RETRY_SECRET: 'retry-secret-value',
  },
}))

vi.mock('@/server/services/webhook-delivery.service', () => ({
  claimWebhookDeliveryForRetry: mocks.claimWebhookDeliveryForRetry,
  getDueWebhookDeliveriesForRetry: mocks.getDueWebhookDeliveriesForRetry,
  markWebhookDeliveryProcessed: mocks.markWebhookDeliveryProcessed,
  markWebhookDeliveryFailed: mocks.markWebhookDeliveryFailed,
}))

vi.mock('@/server/services/stripe-webhook.service', () => ({
  parseStripeWebhookEventPayload: (payload: string) => {
    try {
      return JSON.parse(payload)
    } catch {
      return null
    }
  },
  processStripeWebhookEvent: mocks.processStripeWebhookEvent,
}))

import { POST } from './route'

describe('POST /api/webhook-retries/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getDueWebhookDeliveriesForRetry.mockResolvedValue([
      {
        id: 'delivery_1',
        provider: 'stripe',
        providerEventId: 'evt_1',
      },
    ])
    mocks.claimWebhookDeliveryForRetry.mockResolvedValue({
      id: 'delivery_1',
      provider: 'stripe',
      providerEventId: 'evt_1',
      rawPayload: JSON.stringify({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1',
            amount: 5999,
            currency: 'usd',
            status: 'succeeded',
          },
        },
      }),
    })
  })

  it('rejects requests without the retry secret', async () => {
    const response = await POST(new Request('http://localhost/api/webhook-retries/run', { method: 'POST' }))

    expect(response.status).toBe(401)
    expect(mocks.getDueWebhookDeliveriesForRetry).not.toHaveBeenCalled()
  })

  it('processes due retries from verified local payloads', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhook-retries/run?limit=5', {
        method: 'POST',
        headers: {
          authorization: 'Bearer retry-secret-value',
        },
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.getDueWebhookDeliveriesForRetry).toHaveBeenCalledWith(5)
    expect(mocks.claimWebhookDeliveryForRetry).toHaveBeenCalledWith('delivery_1')
    expect(mocks.processStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt_1',
      })
    )
    expect(mocks.markWebhookDeliveryProcessed).toHaveBeenCalledWith({
      provider: 'stripe',
      providerEventId: 'evt_1',
    })
  })

  it('reschedules processing failures through the delivery service', async () => {
    mocks.processStripeWebhookEvent.mockRejectedValue(new Error('Order finalization failed'))
    mocks.markWebhookDeliveryFailed.mockResolvedValue({
      status: 'RETRY_PENDING',
      nextRetryAt: new Date('2026-04-28T12:01:00.000Z'),
    })

    const response = await POST(
      new Request('http://localhost/api/webhook-retries/run', {
        method: 'POST',
        headers: {
          'x-webhook-retry-secret': 'retry-secret-value',
        },
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.markWebhookDeliveryFailed).toHaveBeenCalledWith({
      provider: 'stripe',
      providerEventId: 'evt_1',
      error: 'Order finalization failed',
      retryable: true,
    })
  })
})
