import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { centsToDollars, dollarsToCents } from '@/lib/money'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  getShippingSettingsStore,
  updateShippingSettings,
} from '@/server/shipping/shipping-settings.service'

function serializeShippingSettings(
  store: any
) {
  return {
    storeId: store.id,
    storeCountry: store.country,
    shippingMode: store.shippingMode,
    shippingLiveProvider: store.shippingLiveProvider,
    shippingProviderUsage: store.shippingProviderUsage,
    shippingOriginName: store.shippingOriginName,
    shippingOriginPhone: store.shippingOriginPhone,
    shippingOriginAddress1: store.shippingOriginAddress1,
    shippingOriginAddress2: store.shippingOriginAddress2,
    shippingOriginCity: store.shippingOriginCity,
    shippingOriginProvince: store.shippingOriginProvince,
    shippingOriginPostalCode: store.shippingOriginPostalCode,
    shippingOriginCountry: store.shippingOriginCountry,
    defaultPackageWeightOz: store.defaultPackageWeightOz,
    defaultPackageLengthIn: store.defaultPackageLengthIn,
    defaultPackageWidthIn: store.defaultPackageWidthIn,
    defaultPackageHeightIn: store.defaultPackageHeightIn,
    defaultLabelFormat: store.defaultLabelFormat,
    defaultLabelSize: store.defaultLabelSize,
    shippingFallbackEnabled: store.shippingFallbackEnabled,
    shippingThreshold: store.shippingThresholdCents == null ? null : centsToDollars(store.shippingThresholdCents),
    shippingDomesticRate: centsToDollars(store.shippingDomesticRateCents),
    shippingInternationalRate: centsToDollars(store.shippingInternationalRateCents),
    shippingPackages: (store.shippingPackages || []).map((entry: any) => ({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      length: entry.length,
      width: entry.width,
      height: entry.height,
      dimensionUnit: entry.dimensionUnit,
      emptyPackageWeight: entry.emptyPackageWeight,
      weightUnit: entry.weightUnit,
      isDefault: entry.isDefault,
      isActive: entry.isActive,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    shippingLocations: (store.shippingLocations || []).map((location: any) => ({
      id: location.id,
      name: location.name,
      contactName: location.contactName,
      company: location.company,
      address1: location.address1,
      address2: location.address2,
      city: location.city,
      stateProvince: location.stateProvince,
      postalCode: location.postalCode,
      country: location.country,
      phone: location.phone,
      isDefault: location.isDefault,
      isActive: location.isActive,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    })),
    shippingManualRates: (store.shippingManualRates || []).map((rate: any) => ({
      id: rate.id,
      name: rate.name,
      regionCountry: rate.regionCountry,
      regionStateProvince: rate.regionStateProvince,
      rateType: rate.rateType,
      amount: centsToDollars(rate.amountCents),
      amountCents: rate.amountCents,
      minWeight: rate.minWeight,
      maxWeight: rate.maxWeight,
      minSubtotal: rate.minSubtotalCents == null ? null : centsToDollars(rate.minSubtotalCents),
      maxSubtotal: rate.maxSubtotalCents == null ? null : centsToDollars(rate.maxSubtotalCents),
      freeOverAmount: rate.freeOverAmountCents == null ? null : centsToDollars(rate.freeOverAmountCents),
      estimatedDeliveryText: rate.estimatedDeliveryText,
      isActive: rate.isActive,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    })),
    shippingFallbackRates: (store.shippingFallbackRates || []).map((rate: any) => ({
      id: rate.id,
      name: rate.name,
      regionCountry: rate.regionCountry,
      regionStateProvince: rate.regionStateProvince,
      amount: centsToDollars(rate.amountCents),
      amountCents: rate.amountCents,
      estimatedDeliveryText: rate.estimatedDeliveryText,
      isActive: rate.isActive,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    })),
    shippingZones: store.shippingZones.map((zone: any) => ({
      id: zone.id,
      name: zone.name,
      countryCode: zone.countryCode,
      provinceCode: zone.provinceCode,
      isActive: zone.isActive,
      priority: zone.priority,
      rates: zone.rates.map((rate: any) => ({
        id: rate.id,
        name: rate.name,
        method: rate.method,
        amount: centsToDollars(rate.amountCents),
        minSubtotal: rate.minSubtotalCents == null ? null : centsToDollars(rate.minSubtotalCents),
        maxSubtotal: rate.maxSubtotalCents == null ? null : centsToDollars(rate.maxSubtotalCents),
        isActive: rate.isActive,
        priority: rate.priority,
      })),
    })),
  }
}

const updateShippingSettingsSchema = z.object({
  shippingMode: z.enum(['MANUAL', 'LIVE_RATES', 'HYBRID']).optional(),
  shippingLiveProvider: z.enum(['EASYPOST', 'SHIPPO']).nullable().optional(),
  shippingProviderUsage: z.enum(['LIVE_AND_LABELS', 'LABELS_ONLY', 'LIVE_RATES_ONLY']).optional(),
  shippingThreshold: z.number().min(0).nullable().optional(),
  shippingDomesticRate: z.number().min(0).optional(),
  shippingInternationalRate: z.number().min(0).optional(),
})

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const store = await getShippingSettingsStore()
    if (!store) return err('Store not configured', 404)

    return ok(serializeShippingSettings(store))
  } catch (error) {
    console.error('[GET /api/settings/shipping]', error)
    return err('Failed to load shipping settings', 500)
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updateShippingSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Shipping settings payload is invalid', parsed.error.flatten())
  }

  try {
    const store = await getShippingSettingsStore()
    if (!store) return err('Store not configured', 404)

    const updated = await updateShippingSettings(store.id, {
      ...(parsed.data.shippingMode !== undefined ? { shippingMode: parsed.data.shippingMode } : {}),
      ...(parsed.data.shippingLiveProvider !== undefined
        ? { shippingLiveProvider: parsed.data.shippingLiveProvider }
        : {}),
      ...(parsed.data.shippingProviderUsage !== undefined
        ? { shippingProviderUsage: parsed.data.shippingProviderUsage }
        : {}),
      ...(parsed.data.shippingThreshold !== undefined
        ? {
            shippingThresholdCents:
              parsed.data.shippingThreshold == null ? null : dollarsToCents(parsed.data.shippingThreshold),
          }
        : {}),
      ...(parsed.data.shippingDomesticRate !== undefined
        ? {
            shippingDomesticRateCents: dollarsToCents(parsed.data.shippingDomesticRate),
          }
        : {}),
      ...(parsed.data.shippingInternationalRate !== undefined
        ? {
            shippingInternationalRateCents: dollarsToCents(parsed.data.shippingInternationalRate),
          }
        : {}),
    })

    return ok(serializeShippingSettings(updated))
  } catch (error) {
    console.error('[PATCH /api/settings/shipping]', error)
    const message = error instanceof Error ? error.message : 'Failed to update shipping settings'
    return err(message, 400)
  }
}
