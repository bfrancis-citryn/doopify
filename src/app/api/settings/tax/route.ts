import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { getTaxSettingsStore, updateTaxSettings } from '@/server/services/tax-settings.service'

function serializeTaxSettings(store: {
  id: string
  taxEnabled: boolean
  taxStrategy: 'NONE' | 'MANUAL'
  defaultTaxRateBps: number
  taxShipping: boolean
  pricesIncludeTax: boolean
  taxOriginCountry: string | null
  taxOriginState: string | null
  taxOriginPostalCode: string | null
}) {
  return {
    storeId: store.id,
    enabled: store.taxEnabled,
    strategy: store.taxStrategy,
    defaultTaxRateBps: store.defaultTaxRateBps,
    defaultTaxRatePercent: Number(store.defaultTaxRateBps || 0) / 100,
    taxShipping: store.taxShipping,
    pricesIncludeTax: store.pricesIncludeTax,
    originCountry: store.taxOriginCountry,
    originState: store.taxOriginState,
    originPostalCode: store.taxOriginPostalCode,
  }
}

const updateTaxSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  strategy: z.enum(['NONE', 'MANUAL']).optional(),
  defaultTaxRatePercent: z.number().min(0).max(100).optional(),
  taxShipping: z.boolean().optional(),
  pricesIncludeTax: z.boolean().optional(),
  originCountry: z.string().trim().max(3).nullable().optional(),
  originState: z.string().trim().max(64).nullable().optional(),
  originPostalCode: z.string().trim().max(32).nullable().optional(),
})

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const store = await getTaxSettingsStore()
    if (!store) return err('Store not configured', 404)
    return ok(serializeTaxSettings(store))
  } catch (error) {
    console.error('[GET /api/settings/tax]', error)
    return err('Failed to load tax settings', 500)
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updateTaxSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Tax settings payload is invalid', parsed.error.flatten())
  }

  try {
    const store = await getTaxSettingsStore()
    if (!store) return err('Store not configured', 404)

    const updated = await updateTaxSettings(store.id, {
      ...(parsed.data.enabled !== undefined ? { taxEnabled: parsed.data.enabled } : {}),
      ...(parsed.data.strategy !== undefined ? { taxStrategy: parsed.data.strategy } : {}),
      ...(parsed.data.defaultTaxRatePercent !== undefined
        ? { defaultTaxRateBps: Math.round(parsed.data.defaultTaxRatePercent * 100) }
        : {}),
      ...(parsed.data.taxShipping !== undefined ? { taxShipping: parsed.data.taxShipping } : {}),
      ...(parsed.data.pricesIncludeTax !== undefined
        ? { pricesIncludeTax: parsed.data.pricesIncludeTax }
        : {}),
      ...(parsed.data.originCountry !== undefined
        ? { taxOriginCountry: parsed.data.originCountry || null }
        : {}),
      ...(parsed.data.originState !== undefined
        ? { taxOriginState: parsed.data.originState || null }
        : {}),
      ...(parsed.data.originPostalCode !== undefined
        ? { taxOriginPostalCode: parsed.data.originPostalCode || null }
        : {}),
    })

    return ok(serializeTaxSettings(updated))
  } catch (error) {
    console.error('[PATCH /api/settings/tax]', error)
    const message = error instanceof Error ? error.message : 'Failed to update tax settings'
    return err(message, 400)
  }
}
