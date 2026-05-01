import { z } from 'zod'

import { err, ok, parseBody, unprocessable } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  deleteShippingPackage,
  updateShippingPackage,
} from '@/server/shipping/shipping-delivery-settings.service'

interface Params {
  params: Promise<{ packageId: string }>
}

const updatePackageSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: z.enum(['BOX', 'POLY_MAILER', 'ENVELOPE', 'CUSTOM']).optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  dimensionUnit: z.enum(['IN', 'CM']).optional(),
  emptyPackageWeight: z.number().positive().optional(),
  weightUnit: z.enum(['OZ', 'LB', 'G', 'KG']).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updatePackageSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Shipping package payload is invalid', parsed.error.flatten())
  }

  const { packageId } = await params

  try {
    const updated = await updateShippingPackage(packageId, parsed.data)
    return ok(updated)
  } catch (error) {
    console.error('[PATCH /api/settings/shipping/packages/[packageId]]', error)
    return err(error instanceof Error ? error.message : 'Failed to update shipping package', 400)
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { packageId } = await params

  try {
    await deleteShippingPackage(packageId)
    return ok({ deleted: true })
  } catch (error) {
    console.error('[DELETE /api/settings/shipping/packages/[packageId]]', error)
    return err(error instanceof Error ? error.message : 'Failed to delete shipping package', 400)
  }
}
