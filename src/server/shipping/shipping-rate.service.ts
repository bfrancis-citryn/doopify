import type { ShippingLiveProvider, ShippingMode } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  getShippingProviderApiKey,
  getShippingProviderConnectionStatus,
  getShippingProviderLiveRates,
} from '@/server/shipping/shipping-provider.service'
import type {
  ShippingRateAddress,
  ShippingRateParcel,
  ShippingRateQuote,
  ShippingRateRequest,
} from '@/server/shipping/shipping-rate.types'

type ShippingRateStore = Awaited<ReturnType<typeof getShippingRateStore>>

export class ShippingRateSetupError extends Error {
  code: 'SETUP_REQUIRED' | 'PROVIDER_ERROR'

  constructor(message: string, code: 'SETUP_REQUIRED' | 'PROVIDER_ERROR' = 'SETUP_REQUIRED') {
    super(message)
    this.name = 'ShippingRateSetupError'
    this.code = code
  }
}

export type GetShippingRatesForCheckoutInput = {
  storeId?: string
  subtotalCents: number
  shippingAddress: ShippingRateAddress
}

const FALLBACK_PRIORITY = 10_000

function normalizeCountry(value?: string | null) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()

  if (!normalized) return ''
  if (normalized === 'USA' || normalized === 'UNITED STATES' || normalized === 'UNITED STATES OF AMERICA') {
    return 'US'
  }
  return normalized
}

function normalizeProvince(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

function normalizeAddress(value: ShippingRateAddress) {
  return {
    name: value.name?.trim() || null,
    phone: value.phone?.trim() || null,
    email: value.email?.trim() || null,
    address1: value.address1?.trim() || null,
    address2: value.address2?.trim() || null,
    city: value.city?.trim() || null,
    province: value.province?.trim() || null,
    postalCode: value.postalCode?.trim() || null,
    country: normalizeCountry(value.country),
  } satisfies ShippingRateAddress
}

function ensureValidSubtotalCents(subtotalCents: number) {
  if (!Number.isInteger(subtotalCents) || subtotalCents < 0) {
    throw new Error('subtotalCents must be a non-negative integer')
  }
}

async function getShippingRateStore(storeId?: string) {
  if (storeId) {
    return prisma.store.findUnique({
      where: { id: storeId },
      include: {
        shippingZones: {
          include: {
            rates: true,
          },
        },
      },
    })
  }

  return prisma.store.findFirst({
    include: {
      shippingZones: {
        include: {
          rates: true,
        },
      },
    },
  })
}

function hasAddressForLiveRateQuotes(address: ShippingRateAddress) {
  return Boolean(address.address1 && address.city && address.postalCode && address.country)
}

function hasOriginForLiveRateQuotes(store: NonNullable<ShippingRateStore>) {
  return Boolean(
    store.shippingOriginAddress1 &&
      store.shippingOriginCity &&
      store.shippingOriginPostalCode &&
      store.shippingOriginCountry
  )
}

function hasDefaultPackageForLiveRates(store: NonNullable<ShippingRateStore>) {
  return Boolean(
    Number(store.defaultPackageWeightOz ?? 0) > 0 &&
      Number(store.defaultPackageLengthIn ?? 0) > 0 &&
      Number(store.defaultPackageWidthIn ?? 0) > 0 &&
      Number(store.defaultPackageHeightIn ?? 0) > 0
  )
}

function buildRateRequestFromStore(input: {
  store: NonNullable<ShippingRateStore>
  shippingAddress: ShippingRateAddress
}): ShippingRateRequest {
  const { store } = input
  const destinationAddress = normalizeAddress(input.shippingAddress)

  if (!hasAddressForLiveRateQuotes(destinationAddress)) {
    throw new ShippingRateSetupError(
      'Destination shipping address is incomplete for live shipping rates. Include address line, city, postal code, and country.'
    )
  }

  if (!hasOriginForLiveRateQuotes(store)) {
    throw new ShippingRateSetupError(
      'Store shipping origin is incomplete. Complete origin address in shipping setup before requesting live rates.'
    )
  }

  if (!hasDefaultPackageForLiveRates(store)) {
    throw new ShippingRateSetupError(
      'Default package is incomplete. Complete package weight and dimensions in shipping setup before requesting live rates.'
    )
  }

  return {
    apiKey: '',
    currency: (store.currency || 'USD').toUpperCase(),
    originAddress: {
      name: store.shippingOriginName,
      phone: store.shippingOriginPhone,
      address1: store.shippingOriginAddress1,
      address2: store.shippingOriginAddress2,
      city: store.shippingOriginCity,
      province: store.shippingOriginProvince,
      postalCode: store.shippingOriginPostalCode,
      country: store.shippingOriginCountry,
    },
    destinationAddress,
    parcel: {
      weightOz: Number(store.defaultPackageWeightOz),
      lengthIn: Number(store.defaultPackageLengthIn),
      widthIn: Number(store.defaultPackageWidthIn),
      heightIn: Number(store.defaultPackageHeightIn),
    },
  }
}

function getMode(store: NonNullable<ShippingRateStore>): ShippingMode {
  return store.shippingMode ?? 'MANUAL'
}

function getProvider(store: NonNullable<ShippingRateStore>): ShippingLiveProvider | null {
  return store.shippingLiveProvider ?? null
}

function resolveManualQuotes(input: {
  store: NonNullable<ShippingRateStore>
  subtotalCents: number
  shippingAddress: ShippingRateAddress
}): ShippingRateQuote[] {
  const { store, subtotalCents } = input
  const destinationCountry = normalizeCountry(input.shippingAddress.country)
  const destinationProvince = normalizeProvince(input.shippingAddress.province)
  const currency = (store.currency || 'USD').toUpperCase()

  if (subtotalCents <= 0) {
    return [
      {
        id: 'manual:none',
        source: 'MANUAL',
        displayName: 'No shipping charge',
        amountCents: 0,
        currency,
      },
    ]
  }

  if (store.shippingThresholdCents != null && subtotalCents >= store.shippingThresholdCents) {
    return [
      {
        id: 'manual:threshold',
        source: 'MANUAL',
        displayName: 'Free shipping threshold',
        amountCents: 0,
        currency,
        metadata: {
          thresholdCents: store.shippingThresholdCents,
        },
      },
    ]
  }

  const matchingZone = store.shippingZones
    .filter((zone) => zone.isActive)
    .filter((zone) => normalizeCountry(zone.countryCode) === destinationCountry)
    .filter((zone) => {
      const zoneProvince = normalizeProvince(zone.provinceCode)
      return !zoneProvince || zoneProvince === destinationProvince
    })
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority
      const leftSpecificity = left.provinceCode ? 1 : 0
      const rightSpecificity = right.provinceCode ? 1 : 0
      if (leftSpecificity !== rightSpecificity) return rightSpecificity - leftSpecificity
      return left.name.localeCompare(right.name)
    })[0]

  if (matchingZone) {
    const quotes = matchingZone.rates
      .filter((rate) => rate.isActive)
      .filter((rate) => {
        if (rate.method !== 'SUBTOTAL_TIER') return true
        const minSubtotalCents = rate.minSubtotalCents ?? 0
        const maxSubtotalCents = rate.maxSubtotalCents ?? Number.POSITIVE_INFINITY
        return subtotalCents >= minSubtotalCents && subtotalCents <= maxSubtotalCents
      })
      .sort((left, right) => {
        if (left.priority !== right.priority) return left.priority - right.priority
        const leftTierMin = left.method === 'SUBTOTAL_TIER' ? left.minSubtotalCents ?? 0 : -1
        const rightTierMin = right.method === 'SUBTOTAL_TIER' ? right.minSubtotalCents ?? 0 : -1
        return rightTierMin - leftTierMin
      })
      .map((rate) => ({
        id: `manual:${matchingZone.id}:${rate.id}`,
        source: 'MANUAL' as const,
        displayName: `${matchingZone.name} - ${rate.name}`,
        amountCents: rate.amountCents,
        currency,
        metadata: {
          zoneId: matchingZone.id,
          zoneName: matchingZone.name,
          rateId: rate.id,
          rateMethod: rate.method,
        },
      }))

    if (quotes.length) return quotes
  }

  const originCountry = normalizeCountry(store.country)
  const isInternational = Boolean(destinationCountry && originCountry && destinationCountry !== originCountry)
  const amountCents = isInternational ? store.shippingInternationalRateCents : store.shippingDomesticRateCents

  return [
    {
      id: `manual:fallback:${isInternational ? 'international' : 'domestic'}`,
      source: 'MANUAL',
      displayName: isInternational ? 'International shipping' : 'Domestic shipping',
      amountCents,
      currency,
      metadata: {
        fallback: true,
        priority: FALLBACK_PRIORITY,
      },
    },
  ]
}

async function resolveLiveQuotes(input: {
  store: NonNullable<ShippingRateStore>
  provider: ShippingLiveProvider
  shippingAddress: ShippingRateAddress
}): Promise<ShippingRateQuote[]> {
  const connectionStatus = await getShippingProviderConnectionStatus(input.provider)
  if (!connectionStatus.connected) {
    throw new ShippingRateSetupError(
      `Live rates require an active ${input.provider} provider connection. Connect credentials in shipping settings first.`
    )
  }

  const apiKey = await getShippingProviderApiKey(input.provider)
  if (!apiKey) {
    throw new ShippingRateSetupError('Provider credentials are missing. Reconnect provider credentials and try again.')
  }

  const rateRequest = buildRateRequestFromStore({
    store: input.store,
    shippingAddress: input.shippingAddress,
  })

  const quotes = await getShippingProviderLiveRates({
    provider: input.provider,
    request: {
      ...rateRequest,
      apiKey,
    },
  })

  if (!quotes.length) {
    throw new ShippingRateSetupError(`${input.provider} returned no live rates for this shipment.`, 'PROVIDER_ERROR')
  }

  return quotes
}

export async function getShippingRatesForCheckout(input: GetShippingRatesForCheckoutInput): Promise<ShippingRateQuote[]> {
  ensureValidSubtotalCents(input.subtotalCents)

  const store = await getShippingRateStore(input.storeId)
  if (!store) {
    throw new ShippingRateSetupError('Store not configured for shipping.')
  }

  const mode = getMode(store)
  const provider = getProvider(store)
  const manualQuotes = () =>
    resolveManualQuotes({
      store,
      subtotalCents: input.subtotalCents,
      shippingAddress: input.shippingAddress,
    })

  if (mode === 'MANUAL') {
    return manualQuotes()
  }

  if (!provider) {
    if (mode === 'HYBRID') return manualQuotes()
    throw new ShippingRateSetupError('Live shipping mode requires selecting a shipping provider in settings.')
  }

  if (mode === 'LIVE_RATES') {
    return resolveLiveQuotes({
      store,
      provider,
      shippingAddress: input.shippingAddress,
    })
  }

  // HYBRID mode: attempt live first, then fall back to manual quotes.
  try {
    return await resolveLiveQuotes({
      store,
      provider,
      shippingAddress: input.shippingAddress,
    })
  } catch {
    if (!store.shippingFallbackEnabled) {
      throw new ShippingRateSetupError('Live rates are unavailable and manual fallback is disabled for hybrid mode.')
    }
    return manualQuotes()
  }
}

export function buildDefaultShippingAddressForRates(input: {
  country: string
  province?: string | null
}): ShippingRateAddress {
  return {
    name: 'Rate Test Customer',
    address1: '1 Test St',
    city: 'Test City',
    postalCode: '00000',
    country: input.country,
    province: input.province ?? null,
  }
}

export function buildDefaultParcelFromStore(store: NonNullable<ShippingRateStore>): ShippingRateParcel | null {
  if (!hasDefaultPackageForLiveRates(store)) return null
  return {
    weightOz: Number(store.defaultPackageWeightOz),
    lengthIn: Number(store.defaultPackageLengthIn),
    widthIn: Number(store.defaultPackageWidthIn),
    heightIn: Number(store.defaultPackageHeightIn),
  }
}
