import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class ShippingSettingsStoreNotConfiguredError extends Error {
    constructor(message = 'Store not configured') {
      super(message)
      this.name = 'ShippingSettingsStoreNotConfiguredError'
    }
  }

  return {
    requireAdmin: vi.fn(),
    createShippingPackage: vi.fn(),
    getShippingDeliveryStore: vi.fn(),
    ShippingSettingsStoreNotConfiguredError,
  }
})

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/shipping/shipping-delivery-settings.service', () => ({
  createShippingPackage: mocks.createShippingPackage,
  getShippingDeliveryStore: mocks.getShippingDeliveryStore,
  ShippingSettingsStoreNotConfiguredError: mocks.ShippingSettingsStoreNotConfiguredError,
}))

import { GET, POST } from './route'

describe('settings shipping packages route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST creates package and returns 201', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.createShippingPackage.mockResolvedValue({
      id: 'pkg_1',
      name: 'Small box',
    })

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Small box',
          type: 'BOX',
          length: 10,
          width: 8,
          height: 4,
          dimensionUnit: 'IN',
          emptyPackageWeight: 6,
          weightUnit: 'OZ',
          isDefault: true,
          isActive: true,
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(mocks.createShippingPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Small box',
        type: 'BOX',
        length: 10,
        width: 8,
        height: 4,
      })
    )
  })

  it('POST returns field-level validation details for invalid payload', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          type: 'BOX',
          length: 0,
          width: -1,
          height: 4,
          dimensionUnit: 'IN',
          emptyPackageWeight: 0,
          weightUnit: 'OZ',
          isDefault: false,
          isActive: true,
        }),
      })
    )

    expect(response.status).toBe(422)
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: false,
      error: 'Shipping package payload is invalid',
      details: {
        fieldErrors: {
          name: expect.any(Array),
          length: expect.any(Array),
          width: expect.any(Array),
          emptyPackageWeight: expect.any(Array),
        },
      },
    })
  })

  it('POST returns actionable setup error when store setup fails', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.createShippingPackage.mockRejectedValue(
      new mocks.ShippingSettingsStoreNotConfiguredError()
    )

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Small box',
          type: 'BOX',
          length: 10,
          width: 8,
          height: 4,
          dimensionUnit: 'IN',
          emptyPackageWeight: 6,
          weightUnit: 'OZ',
          isDefault: true,
          isActive: true,
        }),
      })
    )

    expect(response.status).toBe(409)
    const payload = await response.json()
    expect(payload.error).toContain('Open Settings > Shipping')
  })

  it('GET returns packages list', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.getShippingDeliveryStore.mockResolvedValue({
      shippingPackages: [
        {
          id: 'pkg_1',
          name: 'Small box',
          type: 'BOX',
          length: 10,
          width: 8,
          height: 4,
          dimensionUnit: 'IN',
          emptyPackageWeight: 6,
          weightUnit: 'OZ',
          isDefault: true,
          isActive: true,
        },
      ],
    })

    const response = await GET(new Request('http://localhost/api/settings/shipping/packages'))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      data: {
        packages: [{ id: 'pkg_1', name: 'Small box' }],
      },
    })
  })
})
