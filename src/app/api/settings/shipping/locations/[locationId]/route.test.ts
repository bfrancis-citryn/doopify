import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  updateShippingLocation: vi.fn(),
  deleteShippingLocation: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/shipping/shipping-delivery-settings.service', () => ({
  updateShippingLocation: mocks.updateShippingLocation,
  deleteShippingLocation: mocks.deleteShippingLocation,
}))

import { PATCH } from './route'

describe('settings shipping location detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCH accepts and persists location email', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.updateShippingLocation.mockResolvedValue({
      id: 'loc_1',
      email: 'ops@example.com',
    })

    const response = await PATCH(
      new Request('http://localhost/api/settings/shipping/locations/loc_1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'ops@example.com',
        }),
      }),
      { params: Promise.resolve({ locationId: 'loc_1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.updateShippingLocation).toHaveBeenCalledWith(
      'loc_1',
      expect.objectContaining({
        email: 'ops@example.com',
      })
    )
  })
})
