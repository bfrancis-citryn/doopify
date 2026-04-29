import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    store: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  getShippingProviderConnectionStatus: vi.fn(),
  getShippingProviderApiKey: vi.fn(),
  getShippingProviderLiveRates: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/server/shipping/shipping-provider.service', () => ({
  getShippingProviderConnectionStatus: mocks.getShippingProviderConnectionStatus,
  getShippingProviderApiKey: mocks.getShippingProviderApiKey,
  getShippingProviderLiveRates: mocks.getShippingProviderLiveRates,
}))

import { getShippingRatesForCheckout, ShippingRateSetupError } from './shipping-rate.service'

function storeFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'store_1',
    currency: 'USD',
    country: 'US',
    shippingMode: 'MANUAL',
    shippingLiveProvider: null,
    shippingFallbackEnabled: true,
    shippingThresholdCents: null,
    shippingDomesticRateCents: 999,
    shippingInternationalRateCents: 1999,
    shippingOriginName: 'Doopify Warehouse',
    shippingOriginPhone: '5551230000',
    shippingOriginAddress1: '1 Warehouse Way',
    shippingOriginAddress2: null,
    shippingOriginCity: 'Los Angeles',
    shippingOriginProvince: 'CA',
    shippingOriginPostalCode: '90001',
    shippingOriginCountry: 'US',
    defaultPackageWeightOz: 16,
    defaultPackageLengthIn: 10,
    defaultPackageWidthIn: 8,
    defaultPackageHeightIn: 4,
    shippingZones: [],
    ...overrides,
  }
}

describe('shipping-rate service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns normalized manual quotes from matching zone rates', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'MANUAL',
        shippingZones: [
          {
            id: 'zone_1',
            name: 'US Mainland',
            countryCode: 'US',
            provinceCode: null,
            isActive: true,
            priority: 1,
            rates: [
              {
                id: 'rate_fast',
                name: 'Fast',
                method: 'FLAT',
                amountCents: 1499,
                minSubtotalCents: null,
                maxSubtotalCents: null,
                isActive: true,
                priority: 20,
              },
              {
                id: 'rate_standard',
                name: 'Standard',
                method: 'FLAT',
                amountCents: 899,
                minSubtotalCents: null,
                maxSubtotalCents: null,
                isActive: true,
                priority: 10,
              },
            ],
          },
        ],
      })
    )

    const quotes = await getShippingRatesForCheckout({
      subtotalCents: 5000,
      shippingAddress: {
        country: 'US',
        province: 'CA',
        address1: '123 Main St',
        city: 'Los Angeles',
        postalCode: '90001',
      },
    })

    expect(quotes).toHaveLength(2)
    expect(quotes[0]).toMatchObject({
      source: 'MANUAL',
      displayName: 'US Mainland - Standard',
      amountCents: 899,
      currency: 'USD',
    })
    expect(quotes[1]).toMatchObject({
      source: 'MANUAL',
      displayName: 'US Mainland - Fast',
      amountCents: 1499,
      currency: 'USD',
    })
  })

  it('falls back to manual quotes in hybrid mode when provider fails', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'HYBRID',
        shippingLiveProvider: 'EASYPOST',
        shippingDomesticRateCents: 799,
        shippingZones: [],
      })
    )
    mocks.getShippingProviderConnectionStatus.mockResolvedValue({
      connected: true,
    })
    mocks.getShippingProviderApiKey.mockResolvedValue('ep_test_123')
    mocks.getShippingProviderLiveRates.mockRejectedValue(new Error('provider timeout'))

    const quotes = await getShippingRatesForCheckout({
      subtotalCents: 4200,
      shippingAddress: {
        country: 'US',
        province: 'CA',
        address1: '123 Main St',
        city: 'Los Angeles',
        postalCode: '90001',
      },
    })

    expect(quotes).toHaveLength(1)
    expect(quotes[0]).toMatchObject({
      source: 'MANUAL',
      amountCents: 799,
      displayName: 'Domestic shipping',
    })
  })

  it('returns setup error in live mode without connected provider', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'LIVE_RATES',
        shippingLiveProvider: 'SHIPPO',
      })
    )
    mocks.getShippingProviderConnectionStatus.mockResolvedValue({
      connected: false,
    })

    await expect(
      getShippingRatesForCheckout({
        subtotalCents: 4200,
        shippingAddress: {
          country: 'US',
          province: 'CA',
          address1: '123 Main St',
          city: 'Los Angeles',
          postalCode: '90001',
        },
      })
    ).rejects.toBeInstanceOf(ShippingRateSetupError)
  })
})
