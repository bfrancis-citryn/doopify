import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getShippingSetupStore: vi.fn(),
  buildShippingSetupStatus: vi.fn(),
  getShippingRatesForCheckout: vi.fn(),
  buildDefaultShippingAddressForRates: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/shipping/shipping-setup.service', () => ({
  getShippingSetupStore: mocks.getShippingSetupStore,
  buildShippingSetupStatus: mocks.buildShippingSetupStatus,
}))

vi.mock('@/server/shipping/shipping-rate.service', () => ({
  getShippingRatesForCheckout: mocks.getShippingRatesForCheckout,
  buildDefaultShippingAddressForRates: mocks.buildDefaultShippingAddressForRates,
  ShippingRateSetupError: class ShippingRateSetupError extends Error {},
}))

import { POST } from './route'

describe('settings shipping test-rates route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST requires admin auth', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await POST(new Request('http://localhost/api/settings/shipping/test-rates', { method: 'POST' }))
    expect(response.status).toBe(401)
  })

  it('returns normalized manual quotes', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff_1', email: 'staff@example.com', role: 'STAFF' },
    })
    mocks.getShippingSetupStore.mockResolvedValue({
      shippingThresholdCents: 7500,
      shippingDomesticRateCents: 999,
      shippingInternationalRateCents: 1999,
      shippingZones: [],
      storeCountry: 'US',
      country: 'US',
      currency: 'USD',
    })
    mocks.buildShippingSetupStatus.mockResolvedValue({
      mode: 'MANUAL',
      canUseManualRates: true,
      canUseLiveRates: false,
    })
    mocks.buildDefaultShippingAddressForRates.mockReturnValue({
      country: 'US',
      province: null,
      address1: '1 Test St',
      city: 'Test City',
      postalCode: '00000',
    })
    mocks.getShippingRatesForCheckout.mockResolvedValue([
      {
        id: 'manual:rate:1',
        source: 'MANUAL',
        displayName: 'Domestic shipping',
        amountCents: 850,
        currency: 'USD',
      },
    ])

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/test-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtotal: 75,
          destinationCountry: 'US',
        }),
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      data: {
        quotes: [{ source: 'MANUAL', amountCents: 850, amount: 8.5, currency: 'USD' }],
      },
    })
  })
})
