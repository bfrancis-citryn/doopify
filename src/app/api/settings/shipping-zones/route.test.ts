import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listShippingZones: vi.fn(),
  createShippingZone: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/services/shipping-tax-config.service', () => ({
  listShippingZones: mocks.listShippingZones,
  createShippingZone: mocks.createShippingZone,
}))

import { GET, POST } from './route'

describe('settings shipping-zones route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET requires admin auth', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await GET(new Request('http://localhost/api/settings/shipping-zones'))
    expect(response.status).toBe(401)
    expect(mocks.listShippingZones).not.toHaveBeenCalled()
  })

  it('POST converts dollar zone rates into integer cents', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff_1', email: 'staff@example.com', role: 'STAFF' },
    })
    mocks.createShippingZone.mockResolvedValue({
      id: 'zone_1',
      name: 'US',
      countryCode: 'US',
      rates: [],
    })

    const response = await POST(
      new Request('http://localhost/api/settings/shipping-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'US',
          countryCode: 'US',
          rates: [
            {
              name: 'Standard',
              method: 'FLAT',
              amount: 12.99,
            },
            {
              name: 'Tier 1',
              method: 'SUBTOTAL_TIER',
              amount: 5,
              minSubtotal: 50,
              maxSubtotal: 100,
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(mocks.createShippingZone).toHaveBeenCalledWith({
      name: 'US',
      countryCode: 'US',
      rates: [
        {
          name: 'Standard',
          method: 'FLAT',
          amount: 12.99,
          amountCents: 1299,
          minSubtotalCents: null,
          maxSubtotalCents: null,
        },
        {
          name: 'Tier 1',
          method: 'SUBTOTAL_TIER',
          amount: 5,
          amountCents: 500,
          minSubtotal: 50,
          maxSubtotal: 100,
          minSubtotalCents: 5000,
          maxSubtotalCents: 10000,
        },
      ],
    })
  })
})
