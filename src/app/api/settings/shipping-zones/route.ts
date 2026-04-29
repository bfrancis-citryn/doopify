import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { dollarsToCents } from '@/lib/money'
import { createShippingZone, listShippingZones } from '@/server/services/shipping-tax-config.service'

const rateSchema = z
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

const createShippingZoneSchema = z.object({
  name: z.string().trim().min(1).max(120),
  countryCode: z.string().trim().min(2).max(3),
  provinceCode: z.string().trim().max(16).nullable().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(10000).optional(),
  rates: z.array(rateSchema).optional(),
})

export async function GET() {
  try {
    const zones = await listShippingZones()
    return ok(zones)
  } catch (error) {
    console.error('[GET /api/settings/shipping-zones]', error)
    return err('Failed to load shipping zones', 500)
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req)
  if (!body) {
    return err('Invalid request body')
  }

  const parsed = createShippingZoneSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Shipping zone payload is invalid', parsed.error.flatten())
  }

  try {
    const created = await createShippingZone({
      ...parsed.data,
      rates: parsed.data.rates?.map((rate) => ({
        ...rate,
        amountCents: dollarsToCents(rate.amount),
        minSubtotalCents: rate.minSubtotal == null ? null : dollarsToCents(rate.minSubtotal),
        maxSubtotalCents: rate.maxSubtotal == null ? null : dollarsToCents(rate.maxSubtotal),
      })),
    })
    return ok(created, 201)
  } catch (error) {
    console.error('[POST /api/settings/shipping-zones]', error)
    const message = error instanceof Error ? error.message : 'Failed to create shipping zone'
    return err(message, 400)
  }
}
