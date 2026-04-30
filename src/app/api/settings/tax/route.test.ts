import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getTaxSettingsStore: vi.fn(),
  updateTaxSettings: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/services/tax-settings.service', () => ({
  getTaxSettingsStore: mocks.getTaxSettingsStore,
  updateTaxSettings: mocks.updateTaxSettings,
}))

import { GET, PATCH } from './route'

describe('settings tax route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns JSON 401 for unauthenticated access', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    })

    const response = await GET(new Request('http://localhost/api/settings/tax'))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ success: false, error: 'Unauthorized' })
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(mocks.getTaxSettingsStore).not.toHaveBeenCalled()
  })

  it('returns current tax settings in expected shape', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.getTaxSettingsStore.mockResolvedValue({
      id: 'store_1',
      taxEnabled: true,
      taxStrategy: 'MANUAL',
      defaultTaxRateBps: 825,
      taxShipping: true,
      pricesIncludeTax: false,
      taxOriginCountry: 'US',
      taxOriginState: 'CA',
      taxOriginPostalCode: '94105',
    })

    const response = await GET(new Request('http://localhost/api/settings/tax'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toMatchObject({
      storeId: 'store_1',
      enabled: true,
      strategy: 'MANUAL',
      defaultTaxRateBps: 825,
      defaultTaxRatePercent: 8.25,
      taxShipping: true,
      pricesIncludeTax: false,
      originCountry: 'US',
      originState: 'CA',
      originPostalCode: '94105',
    })
  })

  it('validates manual rate and does not call update with invalid values', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })

    const response = await PATCH(
      new Request('http://localhost/api/settings/tax', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultTaxRatePercent: 150 }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(422)
    expect(payload.success).toBe(false)
    expect(mocks.updateTaxSettings).not.toHaveBeenCalled()
  })

  it('stores manual rate as basis points', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.getTaxSettingsStore.mockResolvedValue({
      id: 'store_1',
      taxEnabled: false,
      taxStrategy: 'NONE',
      defaultTaxRateBps: 0,
      taxShipping: false,
      pricesIncludeTax: false,
      taxOriginCountry: null,
      taxOriginState: null,
      taxOriginPostalCode: null,
    })
    mocks.updateTaxSettings.mockResolvedValue({
      id: 'store_1',
      taxEnabled: true,
      taxStrategy: 'MANUAL',
      defaultTaxRateBps: 725,
      taxShipping: true,
      pricesIncludeTax: true,
      taxOriginCountry: 'US',
      taxOriginState: 'WA',
      taxOriginPostalCode: '98101',
    })

    const response = await PATCH(
      new Request('http://localhost/api/settings/tax', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          strategy: 'MANUAL',
          defaultTaxRatePercent: 7.25,
          taxShipping: true,
          pricesIncludeTax: true,
          originCountry: 'US',
          originState: 'WA',
          originPostalCode: '98101',
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.updateTaxSettings).toHaveBeenCalledWith('store_1', {
      taxEnabled: true,
      taxStrategy: 'MANUAL',
      defaultTaxRateBps: 725,
      taxShipping: true,
      pricesIncludeTax: true,
      taxOriginCountry: 'US',
      taxOriginState: 'WA',
      taxOriginPostalCode: '98101',
    })
    expect(payload.success).toBe(true)
    expect(payload.data.defaultTaxRatePercent).toBe(7.25)
  })
})
