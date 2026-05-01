import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { dollarsToCents } from '@/lib/money'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  deleteShippingFallbackRate,
  updateShippingFallbackRate,
} from '@/server/shipping/shipping-delivery-settings.service'

interface Params {
  params: Promise<{ rateId: string }>
}

const updateFallbackRateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  regionCountry: z.string().trim().max(3).nullable().optional(),
  regionStateProvince: z.string().trim().max(120).nullable().optional(),
  amount: z.number().min(0).optional(),
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

  const parsed = updateFallbackRateSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Fallback shipping rate payload is invalid', parsed.error.flatten())
  }

  const { rateId } = await params

  try {
    const updated = await updateShippingFallbackRate(rateId, {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.regionCountry !== undefined
        ? { regionCountry: normalizeOptional(parsed.data.regionCountry)?.toUpperCase() ?? null }
        : {}),
      ...(parsed.data.regionStateProvince !== undefined
        ? { regionStateProvince: normalizeOptional(parsed.data.regionStateProvince) }
        : {}),
      ...(parsed.data.amount !== undefined ? { amountCents: dollarsToCents(parsed.data.amount) } : {}),
      ...(parsed.data.estimatedDeliveryText !== undefined
        ? { estimatedDeliveryText: normalizeOptional(parsed.data.estimatedDeliveryText) }
        : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    })
    return ok(updated)
  } catch (error) {
    console.error('[PATCH /api/settings/shipping/fallback-rates/[rateId]]', error)
    return err(error instanceof Error ? error.message : 'Failed to update fallback shipping rate', 400)
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { rateId } = await params

  try {
    await deleteShippingFallbackRate(rateId)
    return ok({ deleted: true })
  } catch (error) {
    console.error('[DELETE /api/settings/shipping/fallback-rates/[rateId]]', error)
    return err(error instanceof Error ? error.message : 'Failed to delete fallback shipping rate', 400)
  }
}
