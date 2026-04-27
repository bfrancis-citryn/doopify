import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { deleteShippingZone, updateShippingZone } from '@/server/services/shipping-tax-config.service'

const updateShippingZoneSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  countryCode: z.string().trim().min(2).max(3).optional(),
  provinceCode: z.string().trim().max(16).nullable().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(10000).optional(),
})

type RouteContext = {
  params: Promise<{
    zoneId: string
  }>
}

export async function PATCH(req: Request, context: RouteContext) {
  const { zoneId } = await context.params
  const body = await parseBody(req)
  if (!body) {
    return err('Invalid request body')
  }

  const parsed = updateShippingZoneSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Shipping zone payload is invalid', parsed.error.flatten())
  }

  try {
    const updated = await updateShippingZone(zoneId, parsed.data)
    return ok(updated)
  } catch (error) {
    console.error('[PATCH /api/settings/shipping-zones/[zoneId]]', error)
    const message = error instanceof Error ? error.message : 'Failed to update shipping zone'
    return err(message, 400)
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { zoneId } = await context.params

  try {
    await deleteShippingZone(zoneId)
    return ok({ deleted: true })
  } catch (error) {
    console.error('[DELETE /api/settings/shipping-zones/[zoneId]]', error)
    const message = error instanceof Error ? error.message : 'Failed to delete shipping zone'
    return err(message, 400)
  }
}
