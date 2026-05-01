import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  createShippingPackage,
  getShippingDeliveryStore,
} from '@/server/shipping/shipping-delivery-settings.service'

const createPackageSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['BOX', 'POLY_MAILER', 'ENVELOPE', 'CUSTOM']),
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  dimensionUnit: z.enum(['IN', 'CM']),
  emptyPackageWeight: z.number().positive(),
  weightUnit: z.enum(['OZ', 'LB', 'G', 'KG']),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const store = await getShippingDeliveryStore()
    return ok({ packages: store.shippingPackages })
  } catch (error) {
    console.error('[GET /api/settings/shipping/packages]', error)
    return err('Failed to load shipping packages', 500)
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = createPackageSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Shipping package payload is invalid', parsed.error.flatten())
  }

  try {
    const created = await createShippingPackage(parsed.data)
    return ok(created, 201)
  } catch (error) {
    console.error('[POST /api/settings/shipping/packages]', error)
    return err(error instanceof Error ? error.message : 'Failed to create shipping package', 400)
  }
}
