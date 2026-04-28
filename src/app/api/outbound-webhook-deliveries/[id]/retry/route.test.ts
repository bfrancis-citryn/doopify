import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  retryOutboundWebhookDelivery: vi.fn(),
}))

vi.mock('@/server/services/outbound-webhook.service', () => ({
  retryOutboundWebhookDelivery: mocks.retryOutboundWebhookDelivery,
}))

import { POST } from './route'

describe('POST /api/outbound-webhook-deliveries/[id]/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retries a delivery by id', async () => {
    mocks.retryOutboundWebhookDelivery.mockResolvedValue({ id: 'delivery-1', status: 'SUCCESS' })

    const response = await POST(new Request('http://localhost/api/outbound-webhook-deliveries/delivery-1/retry', { method: 'POST' }), {
      params: Promise.resolve({ id: 'delivery-1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual({ id: 'delivery-1', status: 'SUCCESS' })
    expect(mocks.retryOutboundWebhookDelivery).toHaveBeenCalledWith('delivery-1')
  })

  it('returns 404 when the service cannot retry the delivery', async () => {
    mocks.retryOutboundWebhookDelivery.mockResolvedValue(null)

    const response = await POST(new Request('http://localhost/api/outbound-webhook-deliveries/missing/retry', { method: 'POST' }), {
      params: Promise.resolve({ id: 'missing' }),
    })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.success).toBe(false)
  })
})
