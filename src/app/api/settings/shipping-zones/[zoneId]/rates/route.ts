import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { dollarsToCents } from '@/lib/money'
import { createShippingRate } from '@/server/services/shipping-tax-config.service'

const createShippingRateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    method: z.enum(['FLAT', 'SUBTOTAL_TIER']).optional(),
    amount: z.number().min(0),
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
  }>
}

export async function POST(req: Request, context: RouteContext) {
  const { zoneId } = await context.params
  const body = await parseBody(req)
  if (!body) {
    return err('Invalid request body')
  }

  const parsed = createShippingRateSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Shipping rate payload is invalid', parsed.error.flatten())
  }

  try {
    const created = await createShippingRate(zoneId, {
      ...parsed.data,
      amountCents: dollarsToCents(parsed.data.amount),
      minSubtotalCents: parsed.data.minSubtotal == null ? null : dollarsToCents(parsed.data.minSubtotal),
      maxSubtotalCents: parsed.data.maxSubtotal == null ? null : dollarsToCents(parsed.data.maxSubtotal),
    })
    return ok(created, 201)
  } catch (error) {
    console.error('[POST /api/settings/shipping-zones/[zoneId]/rates]', error)
    const message = error instanceof Error ? error.message : 'Failed to create shipping rate'
    return err(message, 400)
  }
}
