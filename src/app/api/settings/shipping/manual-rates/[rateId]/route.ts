import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { dollarsToCents } from '@/lib/money'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  deleteShippingManualRate,
  updateShippingManualRate,
} from '@/server/shipping/shipping-delivery-settings.service'

interface Params {
  params: Promise<{ rateId: string }>
}

const updateManualRateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  regionCountry: z.string().trim().max(3).nullable().optional(),
  regionStateProvince: z.string().trim().max(120).nullable().optional(),
  rateType: z.enum(['FLAT', 'FREE', 'WEIGHT_BASED', 'PRICE_BASED']).optional(),
  amount: z.number().min(0).optional(),
  minWeight: z.number().positive().nullable().optional(),
  maxWeight: z.number().positive().nullable().optional(),
  minSubtotal: z.number().min(0).nullable().optional(),
  maxSubtotal: z.number().min(0).nullable().optional(),
  freeOverAmount: z.number().min(0).nullable().optional(),
  estimatedDeliveryText: z.string().trim().max(140).nullable().optional(),
  isActive: z.boolean().optional(),
})

function normalizeOptional(value?: string | null) {
  if (value == null) return null
  const normalized = value.trim()
  return normalized || null
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updateManualRateSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Manual shipping rate payload is invalid', parsed.error.flatten())
  }

  const { rateId } = await params

  try {
    const updated = await updateShippingManualRate(rateId, {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.regionCountry !== undefined
        ? { regionCountry: normalizeOptional(parsed.data.regionCountry)?.toUpperCase() ?? null }
        : {}),
      ...(parsed.data.regionStateProvince !== undefined
        ? { regionStateProvince: normalizeOptional(parsed.data.regionStateProvince) }
        : {}),
      ...(parsed.data.rateType !== undefined ? { rateType: parsed.data.rateType } : {}),
      ...(parsed.data.amount !== undefined ? { amountCents: dollarsToCents(parsed.data.amount) } : {}),
      ...(parsed.data.minWeight !== undefined ? { minWeight: parsed.data.minWeight ?? null } : {}),
      ...(parsed.data.maxWeight !== undefined ? { maxWeight: parsed.data.maxWeight ?? null } : {}),
      ...(parsed.data.minSubtotal !== undefined
        ? {
            minSubtotalCents:
              parsed.data.minSubtotal == null ? null : dollarsToCents(parsed.data.minSubtotal),
          }
        : {}),
      ...(parsed.data.maxSubtotal !== undefined
        ? {
            maxSubtotalCents:
              parsed.data.maxSubtotal == null || parsed.data.maxSubtotal === 0
                ? null
                : dollarsToCents(parsed.data.maxSubtotal),
          }
        : {}),
      ...(parsed.data.freeOverAmount !== undefined
        ? {
            freeOverAmountCents:
              parsed.data.freeOverAmount == null
                ? null
                : dollarsToCents(parsed.data.freeOverAmount),
          }
        : {}),
      ...(parsed.data.estimatedDeliveryText !== undefined
        ? { estimatedDeliveryText: normalizeOptional(parsed.data.estimatedDeliveryText) }
        : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    })
    return ok(updated)
  } catch (error) {
    console.error('[PATCH /api/settings/shipping/manual-rates/[rateId]]', error)
    return err(error instanceof Error ? error.message : 'Failed to update manual shipping rate', 400)
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { rateId } = await params

  try {
    await deleteShippingManualRate(rateId)
    return ok({ deleted: true })
  } catch (error) {
    console.error('[DELETE /api/settings/shipping/manual-rates/[rateId]]', error)
    return err(error instanceof Error ? error.message : 'Failed to delete manual shipping rate', 400)
  }
}
