import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  deleteShippingLocation,
  updateShippingLocation,
} from '@/server/shipping/shipping-delivery-settings.service'

interface Params {
  params: Promise<{ locationId: string }>
}

const updateLocationSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  contactName: z.string().trim().max(120).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  address1: z.string().trim().min(1).max(160).optional(),
  address2: z.string().trim().max(160).nullable().optional(),
  city: z.string().trim().min(1).max(120).optional(),
  stateProvince: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().min(1).max(32).optional(),
  country: z.string().trim().min(2).max(3).optional(),
  phone: z.string().trim().max(64).nullable().optional(),
  isDefault: z.boolean().optional(),
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

  const parsed = updateLocationSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Ship-from location payload is invalid', parsed.error.flatten())
  }

  const { locationId } = await params

  try {
    const updated = await updateShippingLocation(locationId, {
      ...parsed.data,
      ...(parsed.data.contactName !== undefined ? { contactName: normalizeOptional(parsed.data.contactName) } : {}),
      ...(parsed.data.company !== undefined ? { company: normalizeOptional(parsed.data.company) } : {}),
      ...(parsed.data.address2 !== undefined ? { address2: normalizeOptional(parsed.data.address2) } : {}),
      ...(parsed.data.stateProvince !== undefined ? { stateProvince: normalizeOptional(parsed.data.stateProvince) } : {}),
      ...(parsed.data.country !== undefined ? { country: parsed.data.country.trim().toUpperCase() } : {}),
      ...(parsed.data.phone !== undefined ? { phone: normalizeOptional(parsed.data.phone) } : {}),
    })
    return ok(updated)
  } catch (error) {
    console.error('[PATCH /api/settings/shipping/locations/[locationId]]', error)
    return err(error instanceof Error ? error.message : 'Failed to update ship-from location', 400)
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { locationId } = await params

  try {
    await deleteShippingLocation(locationId)
    return ok({ deleted: true })
  } catch (error) {
    console.error('[DELETE /api/settings/shipping/locations/[locationId]]', error)
    return err(error instanceof Error ? error.message : 'Failed to delete ship-from location', 400)
  }
}
