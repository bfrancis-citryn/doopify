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
    createShippingManualRate: vi.fn(),
    getShippingDeliveryStore: vi.fn(),
    ShippingSettingsStoreNotConfiguredError,
  }
})

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/shipping/shipping-delivery-settings.service', () => ({
  createShippingManualRate: mocks.createShippingManualRate,
  getShippingDeliveryStore: mocks.getShippingDeliveryStore,
  ShippingSettingsStoreNotConfiguredError: mocks.ShippingSettingsStoreNotConfiguredError,
}))

import { GET, POST } from './route'

describe('settings shipping manual-rates route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST requires admin auth', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/manual-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(401)
    expect(mocks.createShippingManualRate).not.toHaveBeenCalled()
  })

  it('POST creates a simple FLAT manual rate and converts dollars to cents', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.createShippingManualRate.mockResolvedValue({
      id: 'rate_1',
      name: 'Test',
      amountCents: 1000,
    })

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/manual-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          regionCountry: 'US',
          regionStateProvince: null,
          rateType: 'FLAT',
          amount: 10,
          estimatedDeliveryText: '3-5 days',
          isActive: true,
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(mocks.createShippingManualRate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test',
        regionCountry: 'US',
        regionStateProvince: null,
        rateType: 'FLAT',
        amountCents: 1000,
        estimatedDeliveryText: '3-5 days',
        isActive: true,
      })
    )
  })

  it('POST returns field-level validation details on invalid payload', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/manual-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          rateType: 'FLAT',
          amount: -1,
        }),
      })
    )

    expect(response.status).toBe(422)
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: false,
      error: 'Manual shipping rate payload is invalid',
      details: {
        fieldErrors: {
          name: expect.any(Array),
          amount: expect.any(Array),
        },
      },
    })
  })

  it('POST returns actionable setup error when store setup fails', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.createShippingManualRate.mockRejectedValue(
      new mocks.ShippingSettingsStoreNotConfiguredError()
    )

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/manual-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          regionCountry: 'US',
          regionStateProvince: null,
          rateType: 'FLAT',
          amount: 10,
          estimatedDeliveryText: '3-5 days',
          isActive: true,
        }),
      })
    )

    expect(response.status).toBe(409)
    const payload = await response.json()
    expect(payload.error).toContain('Open Settings > Shipping')
  })

  it('GET returns manual rates list', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.getShippingDeliveryStore.mockResolvedValue({
      shippingManualRates: [
        {
          id: 'rate_1',
          name: 'Test',
          rateType: 'FLAT',
          amountCents: 1000,
        },
      ],
    })

    const response = await GET(new Request('http://localhost/api/settings/shipping/manual-rates'))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      data: {
        manualRates: [
          {
            id: 'rate_1',
            name: 'Test',
          },
        ],
      },
    })
  })
})
