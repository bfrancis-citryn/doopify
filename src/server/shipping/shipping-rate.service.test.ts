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
    shippingProviderUsage: 'LIVE_AND_LABELS',
    activeRateProvider: 'NONE',
    labelProvider: 'NONE',
    fallbackBehavior: 'SHOW_FALLBACK',
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
    shippingPackages: [
      {
        id: 'pkg_default',
        name: 'Standard box',
        type: 'BOX',
        length: 10,
        width: 8,
        height: 4,
        dimensionUnit: 'IN',
        emptyPackageWeight: 12,
        weightUnit: 'OZ',
        isDefault: true,
        isActive: true,
      },
    ],
    shippingLocations: [
      {
        id: 'loc_default',
        name: 'HQ',
        contactName: 'Warehouse',
        company: 'Doopify',
        address1: '1 Warehouse Way',
        address2: null,
        city: 'Los Angeles',
        stateProvince: 'CA',
        postalCode: '90001',
        country: 'US',
        phone: '5551230000',
        isDefault: true,
        isActive: true,
      },
    ],
    shippingManualRates: [],
    shippingFallbackRates: [],
    shippingZones: [],
    ...overrides,
  }
}

describe('shipping-rate service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns manual rates in MANUAL mode without provider and package/location requirements', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'MANUAL',
        shippingLiveProvider: null,
        shippingPackages: [],
        shippingLocations: [],
        shippingManualRates: [
          {
            id: 'manual_flat',
            name: 'Ground',
            regionCountry: 'US',
            regionStateProvince: null,
            rateType: 'FLAT',
            amountCents: 1299,
            minWeight: null,
            maxWeight: null,
            minSubtotalCents: null,
            maxSubtotalCents: null,
            freeOverAmountCents: null,
            estimatedDeliveryText: '3-5 business days',
            isActive: true,
          },
        ],
      })
    )

    const quotes = await getShippingRatesForCheckout({
      subtotalCents: 5000,
      totalWeightOz: 0,
      shippingAddress: {
        country: 'US',
        province: 'CA',
      },
    })

    expect(quotes).toHaveLength(1)
    expect(quotes[0]).toMatchObject({
      id: 'manual-rate:manual_flat',
      source: 'MANUAL',
      rateType: 'FLAT',
      displayName: 'Ground',
      amountCents: 1299,
      estimatedDeliveryText: '3-5 business days',
    })
    expect(mocks.getShippingProviderLiveRates).not.toHaveBeenCalled()
  })

  it('returns normalized legacy manual quotes from matching zone rates', async () => {
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

  it('returns provider live rates in LIVE_RATES mode when provider is configured', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'LIVE_RATES',
        shippingLiveProvider: 'EASYPOST',
        activeRateProvider: 'EASYPOST',
      })
    )
    mocks.getShippingProviderConnectionStatus.mockResolvedValue({
      connected: true,
    })
    mocks.getShippingProviderApiKey.mockResolvedValue('ep_test_123')
    mocks.getShippingProviderLiveRates.mockResolvedValue([
      {
        id: 'live_1',
        source: 'EASYPOST',
        displayName: 'UPS Ground',
        amountCents: 1175,
        currency: 'USD',
        providerRateId: 'rate_live_1',
      },
    ])

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
      source: 'EASYPOST',
      rateType: 'LIVE_RATE',
      amountCents: 1175,
      providerRateId: 'rate_live_1',
    })
  })

  it('uses fallback rates in LIVE_RATES mode when provider fails', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'LIVE_RATES',
        shippingLiveProvider: 'EASYPOST',
        activeRateProvider: 'EASYPOST',
        shippingFallbackRates: [
          {
            id: 'fb_1',
            name: 'Fallback Ground',
            regionCountry: 'US',
            regionStateProvince: null,
            amountCents: 899,
            estimatedDeliveryText: '4-7 business days',
            isActive: true,
          },
        ],
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
      id: 'fallback:fb_1',
      source: 'MANUAL',
      rateType: 'FALLBACK',
      amountCents: 899,
      estimatedDeliveryText: '4-7 business days',
    })
  })

  it('returns a clear setup error in LIVE_RATES mode when no provider or fallback is configured', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'LIVE_RATES',
        shippingLiveProvider: null,
        shippingFallbackRates: [],
      })
    )

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
    ).rejects.toMatchObject({
      name: 'ShippingRateSetupError',
      message: 'Live shipping mode requires selecting a shipping provider in settings.',
    })
  })

  it('returns live + manual quotes in HYBRID mode, and fallback + manual when live fails', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'HYBRID',
        shippingLiveProvider: 'EASYPOST',
        activeRateProvider: 'EASYPOST',
        shippingManualRates: [
          {
            id: 'manual_hybrid',
            name: 'Manual economy',
            regionCountry: 'US',
            regionStateProvince: null,
            rateType: 'FLAT',
            amountCents: 650,
            minWeight: null,
            maxWeight: null,
            minSubtotalCents: null,
            maxSubtotalCents: null,
            freeOverAmountCents: null,
            estimatedDeliveryText: null,
            isActive: true,
          },
        ],
        shippingFallbackRates: [
          {
            id: 'fallback_hybrid',
            name: 'Fallback default',
            regionCountry: 'US',
            regionStateProvince: null,
            amountCents: 899,
            estimatedDeliveryText: null,
            isActive: true,
          },
        ],
      })
    )
    mocks.getShippingProviderConnectionStatus.mockResolvedValue({
      connected: true,
    })
    mocks.getShippingProviderApiKey.mockResolvedValue('ep_test_123')
    mocks.getShippingProviderLiveRates.mockResolvedValueOnce([
      {
        id: 'live_hybrid_1',
        source: 'EASYPOST',
        displayName: 'Live Ground',
        amountCents: 1200,
        currency: 'USD',
        providerRateId: 'live_rate_hybrid',
      },
    ])

    const liveQuotes = await getShippingRatesForCheckout({
      subtotalCents: 4200,
      shippingAddress: {
        country: 'US',
        province: 'CA',
        address1: '123 Main St',
        city: 'Los Angeles',
        postalCode: '90001',
      },
    })

    expect(liveQuotes).toHaveLength(2)
    expect(liveQuotes[0]).toMatchObject({ source: 'EASYPOST', rateType: 'LIVE_RATE' })
    expect(liveQuotes[1]).toMatchObject({ id: 'manual-rate:manual_hybrid', source: 'MANUAL' })

    mocks.getShippingProviderLiveRates.mockRejectedValueOnce(new Error('timeout'))
    const fallbackQuotes = await getShippingRatesForCheckout({
      subtotalCents: 4200,
      shippingAddress: {
        country: 'US',
        province: 'CA',
        address1: '123 Main St',
        city: 'Los Angeles',
        postalCode: '90001',
      },
    })

    expect(fallbackQuotes).toHaveLength(2)
    expect(fallbackQuotes[0]).toMatchObject({ id: 'fallback:fallback_hybrid', rateType: 'FALLBACK' })
    expect(fallbackQuotes[1]).toMatchObject({ id: 'manual-rate:manual_hybrid' })
  })

  it('returns manual-quote fallback when fallback behavior is MANUAL_QUOTE and live provider fails', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'LIVE_RATES',
        shippingLiveProvider: 'EASYPOST',
        activeRateProvider: 'EASYPOST',
        fallbackBehavior: 'MANUAL_QUOTE',
        shippingFallbackRates: [],
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
      id: 'fallback:manual-quote',
      source: 'MANUAL',
      rateType: 'FALLBACK',
      amountCents: 0,
    })
  })

  it('blank state/province matches all US states for manual rate', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'MANUAL',
        shippingManualRates: [
          {
            id: 'rate_us_any_state',
            name: 'US Shipping',
            regionCountry: 'US',
            regionStateProvince: null,
            rateType: 'FLAT',
            amountCents: 799,
            minWeight: null,
            maxWeight: null,
            minSubtotalCents: null,
            maxSubtotalCents: null,
            freeOverAmountCents: null,
            estimatedDeliveryText: null,
            isActive: true,
          },
        ],
      })
    )

    const txQuotes = await getShippingRatesForCheckout({
      subtotalCents: 3000,
      totalWeightOz: 0,
      shippingAddress: { country: 'US', province: 'TX' },
    })
    expect(txQuotes).toHaveLength(1)
    expect(txQuotes[0].amountCents).toBe(799)

    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'MANUAL',
        shippingManualRates: [
          {
            id: 'rate_us_any_state',
            name: 'US Shipping',
            regionCountry: 'US',
            regionStateProvince: null,
            rateType: 'FLAT',
            amountCents: 799,
            minWeight: null,
            maxWeight: null,
            minSubtotalCents: null,
            maxSubtotalCents: null,
            freeOverAmountCents: null,
            estimatedDeliveryText: null,
            isActive: true,
          },
        ],
      })
    )

    const nyQuotes = await getShippingRatesForCheckout({
      subtotalCents: 3000,
      totalWeightOz: 0,
      shippingAddress: { country: 'US', province: 'NY' },
    })
    expect(nyQuotes).toHaveLength(1)
    expect(nyQuotes[0].amountCents).toBe(799)
  })

  it('state-specific rate matches only the specified state', async () => {
    const fixture = storeFixture({
      shippingMode: 'MANUAL',
      shippingManualRates: [
        {
          id: 'rate_ca_only',
          name: 'CA Rate',
          regionCountry: 'US',
          regionStateProvince: 'CA',
          rateType: 'FLAT',
          amountCents: 599,
          minWeight: null,
          maxWeight: null,
          minSubtotalCents: null,
          maxSubtotalCents: null,
          freeOverAmountCents: null,
          estimatedDeliveryText: null,
          isActive: true,
        },
      ],
    })

    mocks.prisma.store.findFirst.mockResolvedValue(fixture)
    const caQuotes = await getShippingRatesForCheckout({
      subtotalCents: 3000,
      totalWeightOz: 0,
      shippingAddress: { country: 'US', province: 'CA' },
    })
    expect(caQuotes).toHaveLength(1)
    expect(caQuotes[0].id).toBe('manual-rate:rate_ca_only')

    // For TX the modern rate does not match; in non-production mode the legacy
    // domestic fallback may apply. Verify the CA-specific rate is NOT returned.
    mocks.prisma.store.findFirst.mockResolvedValue(fixture)
    const txQuotes = await getShippingRatesForCheckout({
      subtotalCents: 3000,
      totalWeightOz: 0,
      shippingAddress: { country: 'US', province: 'TX' },
    })
    expect(txQuotes.every((q) => q.id !== 'manual-rate:rate_ca_only')).toBe(true)
  })

  it('weight-based rate matches when cart weight is within min/max range', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'MANUAL',
        shippingManualRates: [
          {
            id: 'rate_weight',
            name: 'Heavy Ship',
            regionCountry: 'US',
            regionStateProvince: null,
            rateType: 'WEIGHT_BASED',
            amountCents: 1500,
            minWeight: 4,
            maxWeight: 32,
            minSubtotalCents: null,
            maxSubtotalCents: null,
            freeOverAmountCents: null,
            estimatedDeliveryText: null,
            isActive: true,
          },
        ],
      })
    )

    const quotes = await getShippingRatesForCheckout({
      subtotalCents: 5000,
      totalWeightOz: 16,
      shippingAddress: { country: 'US', province: 'CA' },
    })
    expect(quotes).toHaveLength(1)
    expect(quotes[0].amountCents).toBe(1500)
  })

  it('weight-based rate does not match when product weights are not set (totalWeightOz=0)', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'MANUAL',
        shippingManualRates: [
          {
            id: 'rate_weight_only',
            name: 'Weight Ship',
            regionCountry: 'US',
            regionStateProvince: null,
            rateType: 'WEIGHT_BASED',
            amountCents: 1000,
            minWeight: 0.1,
            maxWeight: 100,
            minSubtotalCents: null,
            maxSubtotalCents: null,
            freeOverAmountCents: null,
            estimatedDeliveryText: null,
            isActive: true,
          },
        ],
      })
    )

    // totalWeightOz=0 < minWeight=0.1 so the weight-based rate must not appear.
    // In non-production mode the service may return a legacy domestic fallback —
    // the important assertion is that the weight-based rate itself is excluded.
    const quotes = await getShippingRatesForCheckout({
      subtotalCents: 5000,
      totalWeightOz: 0,
      shippingAddress: { country: 'US', province: 'CA' },
    })
    expect(quotes.some((q) => q.id === 'manual-rate:rate_weight_only')).toBe(false)
  })

  it('PRICE_BASED rate with null maxSubtotalCents matches all cart sizes above min', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'MANUAL',
        shippingManualRates: [
          {
            id: 'rate_price_no_max',
            name: 'Price-based no max',
            regionCountry: 'US',
            regionStateProvince: null,
            rateType: 'PRICE_BASED',
            amountCents: 499,
            minWeight: null,
            maxWeight: null,
            minSubtotalCents: 0,
            maxSubtotalCents: null,
            freeOverAmountCents: null,
            estimatedDeliveryText: null,
            isActive: true,
          },
        ],
      })
    )

    const quotes = await getShippingRatesForCheckout({
      subtotalCents: 999999,
      totalWeightOz: 0,
      shippingAddress: { country: 'US', province: 'CA' },
    })
    expect(quotes).toHaveLength(1)
    expect(quotes[0].amountCents).toBe(499)
  })

  it('PRICE_BASED rate with maxSubtotalCents=0 is treated as no maximum (not $0 cap)', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'MANUAL',
        shippingManualRates: [
          {
            id: 'rate_price_zero_max',
            name: 'Price-based zero max',
            regionCountry: 'US',
            regionStateProvince: null,
            rateType: 'PRICE_BASED',
            amountCents: 599,
            minWeight: null,
            maxWeight: null,
            minSubtotalCents: 0,
            maxSubtotalCents: 0,
            freeOverAmountCents: null,
            estimatedDeliveryText: null,
            isActive: true,
          },
        ],
      })
    )

    const quotes = await getShippingRatesForCheckout({
      subtotalCents: 5000,
      totalWeightOz: 0,
      shippingAddress: { country: 'US', province: 'CA' },
    })
    expect(quotes).toHaveLength(1)
    expect(quotes[0].amountCents).toBe(599)
  })

  it('throws when fallback behavior is HIDE_SHIPPING and live rates fail', async () => {
    mocks.prisma.store.findFirst.mockResolvedValue(
      storeFixture({
        shippingMode: 'LIVE_RATES',
        shippingLiveProvider: 'EASYPOST',
        activeRateProvider: 'EASYPOST',
        fallbackBehavior: 'HIDE_SHIPPING',
        shippingFallbackRates: [
          {
            id: 'fb_ignored',
            name: 'Ignored fallback',
            regionCountry: 'US',
            regionStateProvince: null,
            amountCents: 1200,
            estimatedDeliveryText: null,
            isActive: true,
          },
        ],
      })
    )
    mocks.getShippingProviderConnectionStatus.mockResolvedValue({
      connected: true,
    })
    mocks.getShippingProviderApiKey.mockResolvedValue('ep_test_123')
    mocks.getShippingProviderLiveRates.mockRejectedValue(new Error('provider timeout'))

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
    ).rejects.toThrow('provider timeout')
  })
})
