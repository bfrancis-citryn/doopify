import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/server/auth/require-auth'
import { createPaymentRefundRecord } from '@/server/services/order-adjustments.service'

interface Params {
  params: Promise<{ orderNumber: string }>
}

const createRefundRecordSchema = z.object({
  paymentId: z.string().min(1).optional(),
  amountCents: z.number().int().positive(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']),
  note: z.string().optional(),
  restockItems: z.boolean().optional(),
  returnId: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        variantId: z.string().optional(),
        quantity: z.number().int().positive(),
        amountCents: z.number().int().positive(),
      })
    )
    .optional(),
})

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params
  const parsedOrderNumber = parseInt(orderNumber, 10)
  if (Number.isNaN(parsedOrderNumber)) {
    return err('Invalid order number', 400)
  }

  const body = await parseBody(req)
  if (!body) {
    return err('Invalid request body')
  }

  const parsed = createRefundRecordSchema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.errors[0]?.message ?? 'Invalid request body')
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: parsedOrderNumber },
      select: { id: true },
    })

    if (!order) {
      return err('Order not found', 404)
    }

    const refundRecord = await createPaymentRefundRecord(order.id, parsed.data)
    return ok(refundRecord, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create refund record'
    console.error('[POST /api/orders/[orderNumber]/refund-records]', error)
    return err(message, 400)
  }
}
