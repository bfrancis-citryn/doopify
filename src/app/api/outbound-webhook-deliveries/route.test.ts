import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    outboundWebhookDelivery: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

import { GET } from './route'

describe('GET /api/outbound-webhook-deliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff-1', email: 'staff@example.com', firstName: null, lastName: null, role: 'STAFF' },
    })
    mocks.prisma.outboundWebhookDelivery.count.mockResolvedValue(1)
    mocks.prisma.outboundWebhookDelivery.findMany.mockResolvedValue([
      {
        id: 'delivery-1',
        event: 'order.paid',
        status: 'SUCCESS',
        integration: { id: 'int-1', name: 'Merchant webhook', status: 'ACTIVE', webhookUrl: 'https://merchant.example/webhooks' },
      },
    ])
  })

  it('lists outbound deliveries with pagination and status filter', async () => {
    const response = await GET(new Request('http://localhost/api/outbound-webhook-deliveries?status=SUCCESS&page=2&pageSize=10'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.pagination).toEqual({ page: 2, pageSize: 10, total: 1, totalPages: 1 })
    expect(mocks.prisma.outboundWebhookDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'SUCCESS' },
        skip: 10,
        take: 10,
      })
    )
  })

  it('rejects invalid status filters', async () => {
    const response = await GET(new Request('http://localhost/api/outbound-webhook-deliveries?status=BAD'))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
    expect(mocks.prisma.outboundWebhookDelivery.findMany).not.toHaveBeenCalled()
  })
})
