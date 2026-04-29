import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyShippingProviderWebhookSignature: vi.fn(),
  parseShippingProviderWebhookPayload: vi.fn(),
  applyShippingProviderTrackingWebhookEvent: vi.fn(),
  recordWebhookDeliveryAttempt: vi.fn(),
  storeVerifiedWebhookPayload: vi.fn(),
  markWebhookDeliveryProcessed: vi.fn(),
  markWebhookDeliveryFailed: vi.fn(),
}))

vi.mock('@/server/shipping/shipping-tracking-webhook.service', () => ({
  verifyShippingProviderWebhookSignature: mocks.verifyShippingProviderWebhookSignature,
  parseShippingProviderWebhookPayload: mocks.parseShippingProviderWebhookPayload,
  applyShippingProviderTrackingWebhookEvent: mocks.applyShippingProviderTrackingWebhookEvent,
}))

vi.mock('@/server/services/webhook-delivery.service', () => ({
  recordWebhookDeliveryAttempt: mocks.recordWebhookDeliveryAttempt,
  storeVerifiedWebhookPayload: mocks.storeVerifiedWebhookPayload,
  markWebhookDeliveryProcessed: mocks.markWebhookDeliveryProcessed,
  markWebhookDeliveryFailed: mocks.markWebhookDeliveryFailed,
}))

import { POST } from './route'

describe('POST /api/webhooks/shipping-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyShippingProviderWebhookSignature.mockImplementation(() => undefined)
    mocks.parseShippingProviderWebhookPayload.mockReturnValue({
      provider: 'EASYPOST',
      providerEventId: 'evt_1',
      eventType: 'tracker.updated',
      providerStatus: 'IN_TRANSIT',
      lifecycleStatus: 'IN_TRANSIT',
      trackingNumber: 'TRACK123',
    })
    mocks.recordWebhookDeliveryAttempt.mockResolvedValue({
      provider: 'shipping.easypost',
      providerEventId: 'evt_1',
    })
    mocks.applyShippingProviderTrackingWebhookEvent.mockResolvedValue({ handled: true })
  })

  it('requires provider query parameter', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhooks/shipping-provider', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Shipping provider query is required (provider=EASYPOST|SHIPPO)')
  })

  it('rejects invalid signatures', async () => {
    mocks.verifyShippingProviderWebhookSignature.mockImplementation(() => {
      throw new Error('EasyPost webhook signature verification failed')
    })

    const response = await POST(
      new Request('http://localhost/api/webhooks/shipping-provider?provider=EASYPOST', {
        method: 'POST',
        body: JSON.stringify({ id: 'evt_1' }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('EasyPost webhook signature verification failed')
    expect(mocks.markWebhookDeliveryFailed).toHaveBeenCalledWith({
      provider: 'shipping.easypost',
      providerEventId: 'evt_1',
      status: 'SIGNATURE_FAILED',
      error: 'EasyPost webhook signature verification failed',
    })
  })

  it('processes verified shipping tracking webhook events', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhooks/shipping-provider?provider=EASYPOST', {
        method: 'POST',
        body: JSON.stringify({
          id: 'evt_1',
          description: 'tracker.updated',
          result: {
            tracking_code: 'TRACK123',
            status: 'in_transit',
          },
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
    expect(mocks.storeVerifiedWebhookPayload).toHaveBeenCalledWith({
      provider: 'shipping.easypost',
      providerEventId: 'evt_1',
      rawPayload: expect.stringContaining('tracker.updated'),
    })
    expect(mocks.applyShippingProviderTrackingWebhookEvent).toHaveBeenCalled()
    expect(mocks.markWebhookDeliveryProcessed).toHaveBeenCalledWith({
      provider: 'shipping.easypost',
      providerEventId: 'evt_1',
    })
  })
})
