import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createShippingLocation: vi.fn(),
  getShippingDeliveryStore: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/shipping/shipping-delivery-settings.service', () => ({
  createShippingLocation: mocks.createShippingLocation,
  getShippingDeliveryStore: mocks.getShippingDeliveryStore,
}))

import { GET, POST } from './route'

describe('settings shipping locations route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST accepts and persists location email', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.createShippingLocation.mockResolvedValue({
      id: 'loc_1',
      name: 'Warehouse',
      email: 'shipping@example.com',
    })

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Warehouse',
          contactName: 'Ops',
          email: 'shipping@example.com',
          address1: '10 Main St',
          city: 'Austin',
          postalCode: '78701',
          country: 'US',
          isDefault: true,
          isActive: true,
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(mocks.createShippingLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'shipping@example.com',
      })
    )
  })

  it('POST returns field validation error for invalid email', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Warehouse',
          email: 'not-an-email',
          address1: '10 Main St',
          city: 'Austin',
          postalCode: '78701',
          country: 'US',
          isDefault: true,
          isActive: true,
        }),
      })
    )

    expect(response.status).toBe(422)
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: false,
      error: 'Ship-from location payload is invalid',
      details: {
        fieldErrors: {
          email: expect.any(Array),
        },
      },
    })
  })

  it('GET returns shipping locations including email', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.getShippingDeliveryStore.mockResolvedValue({
      shippingLocations: [
        {
          id: 'loc_1',
          name: 'Warehouse',
          email: 'shipping@example.com',
        },
      ],
    })

    const response = await GET(new Request('http://localhost/api/settings/shipping/locations'))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      data: {
        locations: [{ id: 'loc_1', email: 'shipping@example.com' }],
      },
    })
  })
})
