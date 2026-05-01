import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  OrderIdentifierResolutionError,
  resolveOrderIdentifier,
} from '@/server/services/order-identifier.service'
import { createPaymentRefundRecord, updateReturnRecord } from '@/server/services/order-adjustments.service'

interface Params { params: Promise<{ orderNumber: string; returnId: string }> }

const refundItemSchema = z.object({
  orderItemId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1),
  amountCents: z.number().int().positive(),
})

const updateReturnSchema = z.object({
  status: z.enum(['APPROVED', 'DECLINED', 'IN_TRANSIT', 'RECEIVED', 'CLOSED']).optional(),
  reason: z.string().min(1).optional(),
  note: z.string().optional(),
  refund: z.object({
    paymentId: z.string().min(1).optional(),
    amountCents: z.number().int().positive(),
    reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']),
    restockItems: z.boolean().optional(),
    returnId: z.string().min(1).optional(),
    items: z.array(refundItemSchema),
  }).optional(),
}).refine(
  (value) => Boolean(value.status || value.reason != null || value.note != null || value.refund),
  { message: 'No return updates were provided' }
)

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { returnId, orderNumber } = await params

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updateReturnSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const resolvedOrder = await resolveOrderIdentifier(orderNumber)

    if (parsed.data.refund) {
      const refund = await createPaymentRefundRecord(resolvedOrder.orderId, {
        paymentId: parsed.data.refund.paymentId,
        amountCents: parsed.data.refund.amountCents,
        reason: parsed.data.refund.reason,
        note: parsed.data.note,
        restockItems: parsed.data.refund.restockItems,
        returnId: parsed.data.refund.returnId ?? returnId,
        items: parsed.data.refund.items,
      })

      if (parsed.data.status) {
        const updated = await updateReturnRecord(returnId, {
          status: parsed.data.status,
          reason: parsed.data.reason,
          note: parsed.data.note,
        })
        return ok({ updated, refund })
      }

      return ok({ refund })
    }

    const updated = await updateReturnRecord(returnId, {
      status: parsed.data.status,
      reason: parsed.data.reason,
      note: parsed.data.note,
    })
    return ok(updated)
  } catch (e) {
    if (e instanceof OrderIdentifierResolutionError) {
      return err(e.message, e.code === 'INVALID_IDENTIFIER' ? 400 : 404)
    }
    const message = e instanceof Error ? e.message : 'Failed to update return'
    console.error('[PATCH /api/orders/[orderNumber]/returns/[returnId]]', e)
    return err(message, 400)
  }
}
