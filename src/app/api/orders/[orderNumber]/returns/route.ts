import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { auditActorFromUser } from '@/server/services/audit-log.service'
import {
  OrderIdentifierResolutionError,
  resolveOrderIdentifier,
} from '@/server/services/order-identifier.service'
import { createReturnRecord, getOrderAdjustmentSummary } from '@/server/services/order-adjustments.service'

interface Params { params: Promise<{ orderNumber: string }> }

const createReturnSchema = z.object({
  reason: z.string().min(1, 'Return reason is required'),
  note: z.string().optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        variantId: z.string().optional(),
        quantity: z.number().int().min(1),
        reason: z.string().optional(),
      })
    )
    .min(1, 'At least one item is required'),
})

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params

  try {
    const resolvedOrder = await resolveOrderIdentifier(orderNumber)
    const summary = await getOrderAdjustmentSummary(resolvedOrder.orderId)
    return ok(summary.returns)
  } catch (e) {
    if (e instanceof OrderIdentifierResolutionError) {
      return err(e.message, e.code === 'INVALID_IDENTIFIER' ? 400 : 404)
    }
    console.error('[GET /api/orders/[orderNumber]/returns]', e)
    return err('Failed to fetch returns', 500)
  }
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = createReturnSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const resolvedOrder = await resolveOrderIdentifier(orderNumber)
    const returnRecord = await createReturnRecord(resolvedOrder.orderId, {
      ...parsed.data,
      actor: auditActorFromUser(auth.user),
    })
    return ok(returnRecord, 201)
  } catch (e) {
    if (e instanceof OrderIdentifierResolutionError) {
      return err(e.message, e.code === 'INVALID_IDENTIFIER' ? 400 : 404)
    }
    const message = e instanceof Error ? e.message : 'Failed to create return'
    console.error('[POST /api/orders/[orderNumber]/returns]', e)
    return err(message, 400)
  }
}
