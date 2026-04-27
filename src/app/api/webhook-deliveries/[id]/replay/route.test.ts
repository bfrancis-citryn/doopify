import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getWebhookDeliveryById: vi.fn(),
  recordWebhookDeliveryAttempt: vi.fn(),
  markWebhookDeliveryProcessed: vi.fn(),
  markWebhookDeliveryFailed: vi.fn(),
  getStripeEvent: vi.fn(),
  processStripeWebhookEvent: vi.fn(),
}))

vi.mock('@/server/services/webhook-delivery.service', () => ({
  getWebhookDeliveryById: mocks.getWebhookDeliveryById,
  recordWebhookDeliveryAttempt: mocks.recordWebhookDeliveryAttempt,
  markWebhookDeliveryProcessed: mocks.markWebhookDeliveryProcessed,
  markWebhookDeliveryFailed: mocks.markWebhookDeliveryFailed,
}))

vi.mock('@/lib/stripe', () => ({
  getStripeEvent: mocks.getStripeEvent,
}))

vi.mock('@/server/services/stripe-webhook.service', () => ({
  processStripeWebhookEvent: mocks.processStripeWebhookEvent,
}))

import { POST } from './route'

describe('POST /api/webhook-deliveries/[id]/replay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getWebhookDeliveryById.mockResolvedValue({
      id: 'delivery_1',
      provider: 'stripe',
      providerEventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      status: 'FAILED',
    })
    mocks.getStripeEvent.mockResolvedValue({
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
    })
    mocks.recordWebhookDeliveryAttempt.mockResolvedValue({
      id: 'delivery_1',
      provider: 'stripe',
      providerEventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      status: 'RECEIVED',
    })
  })

  it('returns 404 when the webhook delivery does not exist', async () => {
    mocks.getWebhookDeliveryById.mockResolvedValue(null)

    const response = await POST(new Request('http://localhost/api/webhook-deliveries/missing/replay'), {
      params: Promise.resolve({ id: 'missing' }),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Webhook delivery not found',
    })
  })

  it('rejects replay for entries without a provider event id', async () => {
    mocks.getWebhookDeliveryById.mockResolvedValue({
      id: 'delivery_unknown',
      provider: 'stripe',
      providerEventId: 'unknown:abc123',
      eventType: 'unknown',
      status: 'FAILED',
    })

    const response = await POST(new Request('http://localhost/api/webhook-deliveries/delivery_unknown/replay'), {
      params: Promise.resolve({ id: 'delivery_unknown' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Replay requires a provider event id',
    })
  })

  it('replays a Stripe webhook delivery and marks it processed', async () => {
    const response = await POST(new Request('http://localhost/api/webhook-deliveries/delivery_1/replay'), {
      params: Promise.resolve({ id: 'delivery_1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getStripeEvent).toHaveBeenCalledWith('evt_1')
    expect(mocks.processStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
      })
    )
    expect(mocks.markWebhookDeliveryProcessed).toHaveBeenCalledWith({
      provider: 'stripe',
      providerEventId: 'evt_1',
    })
  })

  it('marks replay failures and returns 500 when processing fails', async () => {
    mocks.processStripeWebhookEvent.mockRejectedValue(new Error('Replay processing failed'))

    const response = await POST(new Request('http://localhost/api/webhook-deliveries/delivery_1/replay'), {
      params: Promise.resolve({ id: 'delivery_1' }),
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Webhook replay failed',
    })
    expect(mocks.markWebhookDeliveryFailed).toHaveBeenCalledWith({
      provider: 'stripe',
      providerEventId: 'evt_1',
      error: 'Replay processing failed',
    })
  })
})
