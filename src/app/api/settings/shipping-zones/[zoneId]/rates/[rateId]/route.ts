import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { dollarsToCents } from '@/lib/money'
import { deleteShippingRate, updateShippingRate } from '@/server/services/shipping-tax-config.service'

const updateShippingRateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    method: z.enum(['FLAT', 'SUBTOTAL_TIER']).optional(),
    amount: z.number().min(0).optional(),
    minSubtotal: z.number().min(0).nullable().optional(),
    maxSubtotal: z.number().min(0).nullable().optional(),
    isActive: z.boolean().optional(),
    priority: z.number().int().min(0).max(10000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.method === 'SUBTOTAL_TIER' && value.minSubtotal == null && value.maxSubtotal == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Subtotal-tier rates require minSubtotal or maxSubtotal',
      })
    }

    if (value.minSubtotal != null && value.maxSubtotal != null && value.minSubtotal > value.maxSubtotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minSubtotal cannot exceed maxSubtotal',
      })
    }
  })

type RouteContext = {
  params: Promise<{
    zoneId: string
    rateId: string
  }>
}

export async function PATCH(req: Request, context: RouteContext) {
  const { zoneId, rateId } = await context.params
  const body = await parseBody(req)
  if (!body) {
    return err('Invalid request body')
  }

  const parsed = updateShippingRateSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Shipping rate payload is invalid', parsed.error.flatten())
  }

  try {
    const updated = await updateShippingRate(zoneId, rateId, {
      ...parsed.data,
      ...(parsed.data.amount !== undefined ? { amountCents: dollarsToCents(parsed.data.amount) } : {}),
      ...(parsed.data.minSubtotal !== undefined
        ? {
            minSubtotalCents:
              parsed.data.minSubtotal == null ? null : dollarsToCents(parsed.data.minSubtotal),
          }
        : {}),
      ...(parsed.data.maxSubtotal !== undefined
        ? {
            maxSubtotalCents:
              parsed.data.maxSubtotal == null ? null : dollarsToCents(parsed.data.maxSubtotal),
          }
        : {}),
    })
    return ok(updated)
  } catch (error) {
    console.error('[PATCH /api/settings/shipping-zones/[zoneId]/rates/[rateId]]', error)
    const message = error instanceof Error ? error.message : 'Failed to update shipping rate'
    return err(message, 400)
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { zoneId, rateId } = await context.params

  try {
    await deleteShippingRate(zoneId, rateId)
    return ok({ deleted: true })
  } catch (error) {
    console.error('[DELETE /api/settings/shipping-zones/[zoneId]/rates/[rateId]]', error)
    const message = error instanceof Error ? error.message : 'Failed to delete shipping rate'
    return err(message, 400)
  }
}
