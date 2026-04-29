import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getShippingSetupStore: vi.fn(),
  buildShippingSetupStatus: vi.fn(),
  buildCheckoutPricingWithDecisionsCents: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/shipping/shipping-setup.service', () => ({
  getShippingSetupStore: mocks.getShippingSetupStore,
  buildShippingSetupStatus: mocks.buildShippingSetupStatus,
}))

vi.mock('@/server/checkout/pricing', () => ({
  buildCheckoutPricingWithDecisionsCents: mocks.buildCheckoutPricingWithDecisionsCents,
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

  it('returns normalized manual quote', async () => {
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
    mocks.buildCheckoutPricingWithDecisionsCents.mockReturnValue({
      shippingAmountCents: 850,
      shippingDecision: {
        source: 'fallback',
        amountCents: 850,
      },
    })

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
        quote: {
          source: 'MANUAL',
          amountCents: 850,
          amount: 8.5,
          currency: 'USD',
        },
      },
    })
  })
})
