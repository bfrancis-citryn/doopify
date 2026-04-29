import { type ShippingLiveProvider, type ShippingMode } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getShippingProviderConnectionStatus } from '@/server/shipping/shipping-provider.service'

export type ShippingSetupStatus = {
  mode: 'MANUAL' | 'LIVE_RATES' | 'HYBRID'
  hasOriginAddress: boolean
  hasDefaultPackage: boolean
  hasManualRates: boolean
  hasProvider: boolean
  providerConnected: boolean
  canUseManualRates: boolean
  canUseLiveRates: boolean
  canBuyLabels: boolean
  warnings: string[]
  nextSteps: string[]
}

type ShippingSetupPatch = Partial<{
  shippingMode: ShippingMode
  shippingLiveProvider: ShippingLiveProvider | null
  shippingOriginName: string | null
  shippingOriginPhone: string | null
  shippingOriginAddress1: string | null
  shippingOriginAddress2: string | null
  shippingOriginCity: string | null
  shippingOriginProvince: string | null
  shippingOriginPostalCode: string | null
  shippingOriginCountry: string | null
  defaultPackageWeightOz: number | null
  defaultPackageLengthIn: number | null
  defaultPackageWidthIn: number | null
  defaultPackageHeightIn: number | null
  defaultLabelFormat: string | null
  defaultLabelSize: string | null
  shippingFallbackEnabled: boolean
  shippingThresholdCents: number | null
  shippingDomesticRateCents: number
  shippingInternationalRateCents: number
}>

function includeStoreRelations() {
  return {
    shippingZones: {
      include: {
        rates: {
          orderBy: [{ priority: 'asc' as const }, { createdAt: 'asc' as const }],
        },
      },
      orderBy: [{ priority: 'asc' as const }, { createdAt: 'asc' as const }],
    },
  }
}

function normalizeOptionalText(value?: string | null) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function hasOriginAddress(store: any) {
  return Boolean(
    normalizeOptionalText(store.shippingOriginAddress1) &&
      normalizeOptionalText(store.shippingOriginCity) &&
      normalizeOptionalText(store.shippingOriginPostalCode) &&
      normalizeOptionalText(store.shippingOriginCountry)
  )
}

function hasDefaultPackage(store: any) {
  return Boolean(
    (store.defaultPackageWeightOz ?? 0) > 0 &&
      (store.defaultPackageLengthIn ?? 0) > 0 &&
      (store.defaultPackageWidthIn ?? 0) > 0 &&
      (store.defaultPackageHeightIn ?? 0) > 0
  )
}

function hasManualRates(store: any) {
  const hasFallbackRates =
    Number.isInteger(store.shippingDomesticRateCents) && Number.isInteger(store.shippingInternationalRateCents)
  const hasActiveZoneRates = store.shippingZones.some(
    (zone: any) => zone.isActive && zone.rates.some((rate: any) => rate.isActive)
  )

  return hasFallbackRates || hasActiveZoneRates
}

export async function getShippingSetupStore() {
  return prisma.store.findFirst({
    include: includeStoreRelations(),
  })
}

export async function updateShippingSetup(storeId: string, patch: ShippingSetupPatch) {
  return prisma.store.update({
    where: { id: storeId },
    data: patch,
    include: includeStoreRelations(),
  })
}

export async function buildShippingSetupStatus(store: any) {
  const hasProvider = Boolean(store.shippingLiveProvider)

  let providerConnected = false
  if (store.shippingLiveProvider) {
    const providerStatus = await getShippingProviderConnectionStatus(store.shippingLiveProvider)
    providerConnected = providerStatus.connected
  }

  const originReady = hasOriginAddress(store)
  const packageReady = hasDefaultPackage(store)
  const manualReady = hasManualRates(store)
  const mode = store.shippingMode

  const canUseManualRates = mode === 'MANUAL' ? manualReady : mode === 'HYBRID' ? manualReady : false
  const canUseLiveRates = (mode === 'LIVE_RATES' || mode === 'HYBRID') && hasProvider && providerConnected
  const canBuyLabels = originReady && packageReady && hasProvider && providerConnected

  const warnings: string[] = []
  const nextSteps: string[] = []

  if (!originReady) {
    warnings.push('Shipping origin address is incomplete.')
    nextSteps.push('Add origin address details in setup step 2.')
  }
  if (!packageReady) {
    warnings.push('Default package dimensions/weight are incomplete.')
    nextSteps.push('Add a default package in setup step 3.')
  }
  if (!manualReady) {
    warnings.push('Manual fallback rates are not configured.')
    nextSteps.push('Configure manual fallback rates in setup step 4.')
  }

  if ((mode === 'LIVE_RATES' || mode === 'HYBRID') && !hasProvider) {
    warnings.push('Live shipping mode is selected but no provider is chosen.')
    nextSteps.push('Choose a live provider in setup step 5.')
  }
  if ((mode === 'LIVE_RATES' || mode === 'HYBRID') && hasProvider && !providerConnected) {
    warnings.push('Selected shipping provider is not connected yet.')
    nextSteps.push('Connect and test the provider credentials in setup step 5.')
  }
  if (mode === 'HYBRID' && store.shippingFallbackEnabled && !manualReady) {
    warnings.push('Hybrid mode requires manual fallback rates.')
    nextSteps.push('Configure manual fallback rates before finishing hybrid setup.')
  }

  if (warnings.length === 0) {
    nextSteps.push('Shipping setup looks complete.')
  }

  return {
    mode,
    hasOriginAddress: originReady,
    hasDefaultPackage: packageReady,
    hasManualRates: manualReady,
    hasProvider,
    providerConnected,
    canUseManualRates,
    canUseLiveRates,
    canBuyLabels,
    warnings,
    nextSteps,
  } satisfies ShippingSetupStatus
}
