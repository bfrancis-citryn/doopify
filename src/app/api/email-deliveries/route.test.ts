import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmailDeliveries: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock('@/server/services/email-delivery.service', () => ({
  EMAIL_DELIVERY_STATUSES: ['PENDING', 'SENT', 'FAILED', 'BOUNCED', 'COMPLAINED', 'RETRYING', 'RESEND_REQUESTED'],
  getEmailDeliveries: mocks.getEmailDeliveries,
}))
vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

import { GET } from './route'

describe('GET /api/email-deliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff-1', email: 'staff@example.com', firstName: null, lastName: null, role: 'STAFF' },
    })
  })

  it('returns paginated email deliveries with filters', async () => {
    mocks.getEmailDeliveries.mockResolvedValue({
      deliveries: [{ id: 'email-1', status: 'FAILED' }],
      pagination: { page: 2, pageSize: 5, total: 1, totalPages: 1 },
    })

    const response = await GET(new Request('http://localhost/api/email-deliveries?status=FAILED&page=2&pageSize=5'))

    expect(response.status).toBe(200)
    expect(mocks.getEmailDeliveries).toHaveBeenCalledWith({
      status: 'FAILED',
      page: 2,
      pageSize: 5,
    })
  })

  it('returns 400 for invalid status', async () => {
    const response = await GET(new Request('http://localhost/api/email-deliveries?status=INVALID'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid email delivery status',
    })
  })
})
