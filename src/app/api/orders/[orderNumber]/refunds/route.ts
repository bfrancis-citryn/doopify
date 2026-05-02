import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { dollarsToCents } from '@/lib/money'
import { requireAdmin } from '@/server/auth/require-auth'
import { auditActorFromUser } from '@/server/services/audit-log.service'
import {
  OrderIdentifierResolutionError,
  resolveOrderIdentifier,
} from '@/server/services/order-identifier.service'
import { getOrderRefunds, issueRefund } from '@/server/services/refund.service'

interface Params { params: Promise<{ orderNumber: string }> }

const issueRefundSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
  note: z.string().optional(),
  restockItems: z.boolean().optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        variantId: z.string().optional(),
        quantity: z.number().int().min(1),
        amount: z.number().positive(),
      })
    )
    .optional(),
})

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params

  try {
    const resolvedOrder = await resolveOrderIdentifier(orderNumber)
    const refunds = await getOrderRefunds(resolvedOrder.orderId)
    return ok(refunds)
  } catch (e) {
    if (e instanceof OrderIdentifierResolutionError) {
      return err(e.message, e.code === 'INVALID_IDENTIFIER' ? 400 : 404)
    }
    console.error('[GET /api/orders/[orderNumber]/refunds]', e)
    return err('Failed to fetch refunds', 500)
  }
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = issueRefundSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const resolvedOrder = await resolveOrderIdentifier(orderNumber)

    const refund = await issueRefund({
      orderId: resolvedOrder.orderId,
      paymentId: parsed.data.paymentId,
      amountCents: dollarsToCents(parsed.data.amount),
      reason: parsed.data.reason,
      note: parsed.data.note,
      restockItems: parsed.data.restockItems,
      items: parsed.data.items?.map((item) => ({
        orderItemId: item.orderItemId,
        variantId: item.variantId,
        quantity: item.quantity,
        amountCents: dollarsToCents(item.amount),
      })),
      actor: auditActorFromUser(auth.user),
    })
    return ok(refund, 201)
  } catch (e) {
    if (e instanceof OrderIdentifierResolutionError) {
      return err(e.message, e.code === 'INVALID_IDENTIFIER' ? 400 : 404)
    }
    const message = e instanceof Error ? e.message : 'Failed to issue refund'
    console.error('[POST /api/orders/[orderNumber]/refunds]', e)
    return err(message, 500)
  }
}
