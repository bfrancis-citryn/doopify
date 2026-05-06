import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getShippingSettingsStore: vi.fn(),
  updateShippingSettings: vi.fn(),
  auditActorFromUser: vi.fn(),
  recordAuditLogBestEffort: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/shipping/shipping-settings.service', () => ({
  getShippingSettingsStore: mocks.getShippingSettingsStore,
  updateShippingSettings: mocks.updateShippingSettings,
}))

vi.mock('@/server/services/audit-log.service', () => ({
  auditActorFromUser: mocks.auditActorFromUser,
  recordAuditLogBestEffort: mocks.recordAuditLogBestEffort,
}))

import { GET, PATCH } from './route'

function storeFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'store_1',
    shippingMode: 'MANUAL',
    shippingLiveProvider: null,
    shippingProviderUsage: 'LIVE_AND_LABELS',
    activeRateProvider: 'NONE',
    labelProvider: 'NONE',
    fallbackBehavior: 'SHOW_FALLBACK',
    shippingThresholdCents: 10000,
    shippingDomesticRateCents: 999,
    shippingInternationalRateCents: 1999,
    manualFulfillmentInstructions: null,
    manualTrackingBehavior: null,
    localDeliveryEnabled: false,
    localDeliveryPriceCents: null,
    localDeliveryMinimumOrderCents: null,
    localDeliveryCoverage: null,
    localDeliveryInstructions: null,
    pickupEnabled: false,
    pickupLocation: null,
    pickupInstructions: null,
    pickupEstimate: null,
    packingSlipUseLogo: true,
    packingSlipShowSku: true,
    packingSlipShowProductImages: false,
    packingSlipFooterNote: null,
    shippingPackages: [],
    shippingLocations: [],
    shippingManualRates: [],
    shippingFallbackRates: [],
    shippingZones: [
      {
        id: 'zone_1',
        name: 'US',
        countryCode: 'US',
        provinceCode: null,
        isActive: true,
        priority: 100,
        rates: [
          {
            id: 'rate_1',
            name: 'Standard',
            method: 'FLAT',
            amountCents: 1299,
            minSubtotalCents: null,
            maxSubtotalCents: null,
            isActive: true,
            priority: 100,
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('settings shipping route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auditActorFromUser.mockImplementation((user) => user)
    mocks.recordAuditLogBestEffort.mockResolvedValue(null)
  })

  it('GET /api/settings/shipping requires admin auth', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await GET(new Request('http://localhost/api/settings/shipping'))
    expect(response.status).toBe(401)
    expect(mocks.getShippingSettingsStore).not.toHaveBeenCalled()
  })

  it('PATCH /api/settings/shipping requires admin auth', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
    })

    const response = await PATCH(
      new Request('http://localhost/api/settings/shipping', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shippingDomesticRate: 12.99 }),
      })
    )

    expect(response.status).toBe(403)
    expect(mocks.updateShippingSettings).not.toHaveBeenCalled()
  })

  it('PATCH saves dollar values as integer cents', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.getShippingSettingsStore.mockResolvedValue(storeFixture())
    mocks.updateShippingSettings.mockResolvedValue(
      storeFixture({
        shippingDomesticRateCents: 1249,
        shippingInternationalRateCents: 3050,
        shippingThresholdCents: 15000,
      })
    )

    const response = await PATCH(
      new Request('http://localhost/api/settings/shipping', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingDomesticRate: 12.49,
          shippingInternationalRate: 30.5,
          shippingThreshold: 150,
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.updateShippingSettings).toHaveBeenCalledWith('store_1', {
      shippingDomesticRateCents: 1249,
      shippingInternationalRateCents: 3050,
      shippingThresholdCents: 15000,
    })
    expect(mocks.recordAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'shipping.settings_updated',
      })
    )

    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      data: {
        shippingDomesticRate: 12.49,
        shippingInternationalRate: 30.5,
        shippingThreshold: 150,
      },
    })
  })

  it('GET returns rates as dollars', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff_1', email: 'staff@example.com', role: 'STAFF' },
    })
    mocks.getShippingSettingsStore.mockResolvedValue(storeFixture())

    const response = await GET(new Request('http://localhost/api/settings/shipping'))
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      data: {
        shippingDomesticRate: 9.99,
        shippingInternationalRate: 19.99,
        shippingThreshold: 100,
        activeRateProvider: 'NONE',
        labelProvider: 'NONE',
        fallbackBehavior: 'SHOW_FALLBACK',
        shippingZones: [
          {
            rates: [{ amount: 12.99 }],
          },
        ],
      },
    })
  })

  it('GET includes persisted shipping packages in settings response', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.getShippingSettingsStore.mockResolvedValue(
      storeFixture({
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
            createdAt: '2026-05-06T00:00:00.000Z',
            updatedAt: '2026-05-06T00:00:00.000Z',
          },
        ],
      })
    )

    const response = await GET(new Request('http://localhost/api/settings/shipping'))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      data: {
        shippingPackages: [
          {
            id: 'pkg_1',
            name: 'Small box',
            type: 'BOX',
          },
        ],
      },
    })
  })
})
