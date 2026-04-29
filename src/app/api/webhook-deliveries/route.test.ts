import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getWebhookDeliveries: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock('@/server/services/webhook-delivery.service', () => ({
  getWebhookDeliveries: mocks.getWebhookDeliveries,
}))
vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

import { GET } from './route'

describe('GET /api/webhook-deliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff-1', email: 'staff@example.com', firstName: null, lastName: null, role: 'STAFF' },
    })
  })

  it('returns paginated webhook deliveries with filters', async () => {
    mocks.getWebhookDeliveries.mockResolvedValue({
      deliveries: [
        {
          id: 'delivery_1',
          provider: 'stripe',
          providerEventId: 'evt_1',
          eventType: 'payment_intent.succeeded',
          status: 'PROCESSED',
          attempts: 2,
        },
      ],
      pagination: {
        page: 2,
        pageSize: 5,
        total: 8,
        totalPages: 2,
      },
    })

    const response = await GET(
      new Request(
        'http://localhost/api/webhook-deliveries?provider=stripe&status=processed&eventType=payment_intent.succeeded&search=evt_1&page=2&pageSize=5'
      )
    )

    expect(response.status).toBe(200)
    expect(mocks.getWebhookDeliveries).toHaveBeenCalledWith({
      provider: 'stripe',
      status: 'PROCESSED',
      eventType: 'payment_intent.succeeded',
      search: 'evt_1',
      page: 2,
      pageSize: 5,
    })
  })
})
