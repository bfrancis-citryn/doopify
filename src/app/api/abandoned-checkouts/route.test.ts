import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listAbandonedCheckouts: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/services/abandoned-checkout.service', () => ({
  listAbandonedCheckouts: mocks.listAbandonedCheckouts,
}))

import { GET } from './route'

describe('GET /api/abandoned-checkouts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires admin authorization', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await GET(new Request('http://localhost/api/abandoned-checkouts'))

    expect(response.status).toBe(401)
    expect(mocks.listAbandonedCheckouts).not.toHaveBeenCalled()
  })

  it('returns paginated abandoned checkouts for admins', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff_1', email: 'staff@example.com', firstName: null, lastName: null, role: 'STAFF' },
    })
    mocks.listAbandonedCheckouts.mockResolvedValue({
      checkouts: [{ id: 'checkout_1', recoveryEmailCount: 1 }],
      pagination: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
    })

    const response = await GET(
      new Request('http://localhost/api/abandoned-checkouts?page=2&pageSize=10&search=ada')
    )

    expect(response.status).toBe(200)
    expect(mocks.listAbandonedCheckouts).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      search: 'ada',
    })
  })
})
