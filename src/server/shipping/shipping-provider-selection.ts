import type { ShippingLiveProvider, ShippingProviderSelection, ShippingProviderUsage } from '@prisma/client'

type ProviderConfigLike = {
  activeRateProvider?: ShippingProviderSelection | null
  labelProvider?: ShippingProviderSelection | null
  shippingLiveProvider?: ShippingLiveProvider | null
  shippingProviderUsage?: ShippingProviderUsage | null
}

function toLiveProvider(value: ShippingProviderSelection | null | undefined): ShippingLiveProvider | null {
  if (value === 'EASYPOST' || value === 'SHIPPO') return value
  return null
}

export function resolveActiveRateProvider(config: ProviderConfigLike): ShippingLiveProvider | null {
  const explicit = toLiveProvider(config.activeRateProvider)
  if (explicit) return explicit

  const legacy = config.shippingLiveProvider ?? null
  const usage = config.shippingProviderUsage ?? 'LIVE_AND_LABELS'
  if (!legacy) return null
  if (usage === 'LABELS_ONLY') return null
  return legacy
}

export function resolveLabelProvider(config: ProviderConfigLike): ShippingLiveProvider | null {
  const explicit = toLiveProvider(config.labelProvider)
  if (explicit) return explicit

  const legacy = config.shippingLiveProvider ?? null
  const usage = config.shippingProviderUsage ?? 'LIVE_AND_LABELS'
  if (!legacy) return null
  if (usage === 'LIVE_RATES_ONLY') return null
  return legacy
}

export function buildLegacyProviderFields(input: {
  activeRateProvider?: ShippingProviderSelection | null
  labelProvider?: ShippingProviderSelection | null
}) {
  const active = toLiveProvider(input.activeRateProvider ?? null)
  const label = toLiveProvider(input.labelProvider ?? null)

  if (!active && !label) {
    return {
      shippingLiveProvider: null,
      shippingProviderUsage: 'LIVE_AND_LABELS' as const,
    }
  }

  if (active && label && active === label) {
    return {
      shippingLiveProvider: active,
      shippingProviderUsage: 'LIVE_AND_LABELS' as const,
    }
  }

  if (active) {
    return {
      shippingLiveProvider: active,
      shippingProviderUsage: 'LIVE_RATES_ONLY' as const,
    }
  }

  return {
    shippingLiveProvider: label,
    shippingProviderUsage: 'LABELS_ONLY' as const,
  }
}
