import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { dollarsToCents } from '@/lib/money'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  createShippingFallbackRate,
  getShippingDeliveryStore,
} from '@/server/shipping/shipping-delivery-settings.service'

const createFallbackRateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  regionCountry: z.string().trim().max(3).nullable().optional(),
  regionStateProvince: z.string().trim().max(120).nullable().optional(),
  amount: z.number().min(0),
  estimatedDeliveryText: z.string().trim().max(140).nullable().optional(),
  isActive: z.boolean().default(true),
})

function normalizeOptional(value?: string | null) {
  if (value == null) return null
  const normalized = value.trim()
  return normalized || null
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const store = await getShippingDeliveryStore()
    return ok({ fallbackRates: store.shippingFallbackRates })
  } catch (error) {
    console.error('[GET /api/settings/shipping/fallback-rates]', error)
    return err('Failed to load fallback shipping rates', 500)
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = createFallbackRateSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Fallback shipping rate payload is invalid', parsed.error.flatten())
  }

  try {
    const created = await createShippingFallbackRate({
      name: parsed.data.name,
      regionCountry: normalizeOptional(parsed.data.regionCountry)?.toUpperCase() ?? null,
      regionStateProvince: normalizeOptional(parsed.data.regionStateProvince),
      amountCents: dollarsToCents(parsed.data.amount),
      estimatedDeliveryText: normalizeOptional(parsed.data.estimatedDeliveryText),
      isActive: parsed.data.isActive,
    })
    return ok(created, 201)
  } catch (error) {
    console.error('[POST /api/settings/shipping/fallback-rates]', error)
    return err(error instanceof Error ? error.message : 'Failed to create fallback shipping rate', 400)
  }
}
