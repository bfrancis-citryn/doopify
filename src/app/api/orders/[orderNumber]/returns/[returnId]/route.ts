import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { dollarsToCents } from '@/lib/money'
import { closeReturnWithRefund, updateReturnStatus } from '@/server/services/return.service'

interface Params { params: Promise<{ orderNumber: string; returnId: string }> }

const refundItemSchema = z.object({
  orderItemId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1),
  amount: z.number().positive(),
})

const updateReturnSchema = z.object({
  status: z.enum(['APPROVED', 'DECLINED', 'IN_TRANSIT', 'RECEIVED', 'CLOSED']),
  note: z.string().optional(),
  refund: z.object({
    paymentId: z.string().min(1),
    amount: z.number().positive(),
    reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
    restockItems: z.boolean().optional(),
    items: z.array(refundItemSchema).min(1),
  }).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { returnId } = await params

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updateReturnSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    if (parsed.data.status === 'CLOSED' && parsed.data.refund) {
      const result = await closeReturnWithRefund({
        returnId,
        paymentId: parsed.data.refund.paymentId,
        amountCents: dollarsToCents(parsed.data.refund.amount),
        reason: parsed.data.refund.reason,
        note: parsed.data.note,
        restockItems: parsed.data.refund.restockItems,
        items: parsed.data.refund.items.map((item) => ({
          orderItemId: item.orderItemId,
          variantId: item.variantId,
          quantity: item.quantity,
          amountCents: dollarsToCents(item.amount),
        })),
      })
      return ok(result)
    }

    const updated = await updateReturnStatus(returnId, {
      status: parsed.data.status,
      note: parsed.data.note,
    })
    return ok(updated)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update return'
    console.error('[PATCH /api/orders/[orderNumber]/returns/[returnId]]', e)
    return err(message, 400)
  }
}
