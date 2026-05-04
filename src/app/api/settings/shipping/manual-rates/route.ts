import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { dollarsToCents } from '@/lib/money'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  createShippingManualRate,
  getShippingDeliveryStore,
} from '@/server/shipping/shipping-delivery-settings.service'

const createManualRateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  regionCountry: z.string().trim().max(3).nullable().optional(),
  regionStateProvince: z.string().trim().max(120).nullable().optional(),
  rateType: z.enum(['FLAT', 'FREE', 'WEIGHT_BASED', 'PRICE_BASED']),
  amount: z.number().min(0),
  minWeight: z.number().min(0).nullable().optional(),
  maxWeight: z.number().min(0).nullable().optional(),
  minSubtotal: z.number().min(0).nullable().optional(),
  maxSubtotal: z.number().min(0).nullable().optional(),
  freeOverAmount: z.number().min(0).nullable().optional(),
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
    return ok({ manualRates: store.shippingManualRates })
  } catch (error) {
    console.error('[GET /api/settings/shipping/manual-rates]', error)
    return err('Failed to load manual shipping rates', 500)
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = createManualRateSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Manual shipping rate payload is invalid', parsed.error.flatten())
  }

  try {
    const created = await createShippingManualRate({
      name: parsed.data.name,
      regionCountry: normalizeOptional(parsed.data.regionCountry)?.toUpperCase() ?? null,
      regionStateProvince: normalizeOptional(parsed.data.regionStateProvince),
      rateType: parsed.data.rateType,
      amountCents: dollarsToCents(parsed.data.amount),
      minWeight: parsed.data.minWeight ?? null,
      maxWeight: parsed.data.maxWeight ?? null,
      minSubtotalCents:
        parsed.data.minSubtotal == null ? null : dollarsToCents(parsed.data.minSubtotal),
      maxSubtotalCents:
        parsed.data.maxSubtotal == null || parsed.data.maxSubtotal === 0
          ? null
          : dollarsToCents(parsed.data.maxSubtotal),
      freeOverAmountCents:
        parsed.data.freeOverAmount == null ? null : dollarsToCents(parsed.data.freeOverAmount),
      estimatedDeliveryText: normalizeOptional(parsed.data.estimatedDeliveryText),
      isActive: parsed.data.isActive,
    })
    return ok(created, 201)
  } catch (error) {
    console.error('[POST /api/settings/shipping/manual-rates]', error)
    return err(error instanceof Error ? error.message : 'Failed to create manual shipping rate', 400)
  }
}
