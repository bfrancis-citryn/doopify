import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getWebhookDeliveryDiagnostics: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock('@/server/services/webhook-delivery.service', () => ({
  getWebhookDeliveryDiagnostics: mocks.getWebhookDeliveryDiagnostics,
}))
vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

import { GET } from './route'

describe('GET /api/webhook-deliveries/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff-1', email: 'staff@example.com', firstName: null, lastName: null, role: 'STAFF' },
    })
  })

  it('returns delivery diagnostics', async () => {
    mocks.getWebhookDeliveryDiagnostics.mockResolvedValue({
      delivery: {
        id: 'delivery_1',
        providerEventId: 'evt_1',
        hasVerifiedPayload: true,
      },
      retryPolicy: {
        canRetry: true,
      },
      related: {
        paymentIntentId: 'pi_1',
      },
    })

    const response = await GET(new Request('http://localhost/api/webhook-deliveries/delivery_1'), {
      params: Promise.resolve({ id: 'delivery_1' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      data: {
        delivery: {
          id: 'delivery_1',
          providerEventId: 'evt_1',
          hasVerifiedPayload: true,
        },
        retryPolicy: {
          canRetry: true,
        },
        related: {
          paymentIntentId: 'pi_1',
        },
      },
    })
  })

  it('returns 404 when diagnostics cannot find the delivery', async () => {
    mocks.getWebhookDeliveryDiagnostics.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost/api/webhook-deliveries/missing'), {
      params: Promise.resolve({ id: 'missing' }),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Webhook delivery not found',
    })
  })
})
