import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { centsToDollars, dollarsToCents } from '@/lib/money'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  getShippingSettingsStore,
  updateShippingSettings,
} from '@/server/shipping/shipping-settings.service'

function serializeShippingSettings(
  store: NonNullable<Awaited<ReturnType<typeof getShippingSettingsStore>>>
) {
  return {
    storeId: store.id,
    storeCountry: store.country,
    shippingMode: store.shippingMode,
    shippingLiveProvider: store.shippingLiveProvider,
    shippingThreshold: store.shippingThresholdCents == null ? null : centsToDollars(store.shippingThresholdCents),
    shippingDomesticRate: centsToDollars(store.shippingDomesticRateCents),
    shippingInternationalRate: centsToDollars(store.shippingInternationalRateCents),
    shippingZones: store.shippingZones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      countryCode: zone.countryCode,
      provinceCode: zone.provinceCode,
      isActive: zone.isActive,
      priority: zone.priority,
      rates: zone.rates.map((rate) => ({
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
