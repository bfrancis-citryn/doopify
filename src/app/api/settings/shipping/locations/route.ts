import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  createShippingLocation,
  getShippingDeliveryStore,
} from '@/server/shipping/shipping-delivery-settings.service'

const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contactName: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  address1: z.string().trim().min(1).max(160),
  address2: z.string().trim().max(160).nullable().optional(),
  city: z.string().trim().min(1).max(120),
  stateProvince: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().min(1).max(32),
  country: z.string().trim().min(2).max(3),
  phone: z.string().trim().max(64).nullable().optional(),
  isDefault: z.boolean().default(false),
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
    return ok({ locations: store.shippingLocations })
  } catch (error) {
    console.error('[GET /api/settings/shipping/locations]', error)
    return err('Failed to load ship-from locations', 500)
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = createLocationSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Ship-from location payload is invalid', parsed.error.flatten())
  }

  try {
    const created = await createShippingLocation({
      ...parsed.data,
      contactName: normalizeOptional(parsed.data.contactName),
      email: normalizeOptional(parsed.data.email),
      company: normalizeOptional(parsed.data.company),
      address2: normalizeOptional(parsed.data.address2),
      stateProvince: normalizeOptional(parsed.data.stateProvince),
      country: parsed.data.country.trim().toUpperCase(),
      phone: normalizeOptional(parsed.data.phone),
    })
    return ok(created, 201)
  } catch (error) {
    console.error('[POST /api/settings/shipping/locations]', error)
    return err(error instanceof Error ? error.message : 'Failed to create ship-from location', 400)
  }
}
