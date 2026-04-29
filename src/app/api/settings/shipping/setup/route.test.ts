import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getShippingSetupStore: vi.fn(),
  updateShippingSetup: vi.fn(),
  buildShippingSetupStatus: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/shipping/shipping-setup.service', () => ({
  getShippingSetupStore: mocks.getShippingSetupStore,
  updateShippingSetup: mocks.updateShippingSetup,
  buildShippingSetupStatus: mocks.buildShippingSetupStatus,
}))

import { PATCH } from './route'

function storeFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'store_1',
    shippingMode: 'MANUAL',
    shippingLiveProvider: null,
    shippingOriginName: null,
    shippingOriginPhone: null,
    shippingOriginAddress1: null,
    shippingOriginAddress2: null,
    shippingOriginCity: null,
    shippingOriginProvince: null,
    shippingOriginPostalCode: null,
    shippingOriginCountry: null,
    defaultPackageWeightOz: null,
    defaultPackageLengthIn: null,
    defaultPackageWidthIn: null,
    defaultPackageHeightIn: null,
    defaultLabelFormat: 'PDF',
    defaultLabelSize: '4x6',
    shippingFallbackEnabled: true,
    shippingThresholdCents: 10000,
    shippingDomesticRateCents: 999,
    shippingInternationalRateCents: 1999,
    shippingZones: [],
    ...overrides,
  }
}

describe('settings shipping setup route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCH requires admin auth', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
    })

    const response = await PATCH(
      new Request('http://localhost/api/settings/shipping/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shippingDomesticRate: 12.5 }),
      })
    )

    expect(response.status).toBe(403)
    expect(mocks.updateShippingSetup).not.toHaveBeenCalled()
  })

  it('PATCH converts setup dollar values to integer cents', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.getShippingSetupStore.mockResolvedValue(storeFixture())
    mocks.updateShippingSetup.mockResolvedValue(
      storeFixture({
        shippingOriginAddress1: '123 Main St',
        shippingOriginCity: 'Los Angeles',
        shippingOriginPostalCode: '90001',
        shippingOriginCountry: 'US',
        defaultPackageWeightOz: 12,
        defaultPackageLengthIn: 8,
        defaultPackageWidthIn: 6,
        defaultPackageHeightIn: 4,
        shippingThresholdCents: 7500,
        shippingDomesticRateCents: 850,
      })
    )
    mocks.buildShippingSetupStatus.mockResolvedValue({
      mode: 'MANUAL',
      hasOriginAddress: true,
      hasDefaultPackage: true,
      hasManualRates: true,
      hasProvider: false,
      providerConnected: false,
      canUseManualRates: true,
      canUseLiveRates: false,
      canBuyLabels: false,
      warnings: [],
      nextSteps: ['Shipping setup looks complete.'],
    })

    const response = await PATCH(
      new Request('http://localhost/api/settings/shipping/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingDomesticRate: 8.5,
          shippingThreshold: 75,
          shippingOriginCountry: 'us',
          defaultPackageWeightOz: 12,
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.updateShippingSetup).toHaveBeenCalledWith(
      'store_1',
      expect.objectContaining({
        shippingDomesticRateCents: 850,
        shippingThresholdCents: 7500,
        shippingOriginCountry: 'US',
        defaultPackageWeightOz: 12,
      })
    )
  })
})
