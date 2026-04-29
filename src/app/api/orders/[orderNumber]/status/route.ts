import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/server/auth/require-auth'
import { updatePaymentStatus, updateFulfillmentStatus } from '@/server/services/order.service'
import type { PaymentStatus, FulfillmentStatus } from '@prisma/client'

interface Params { params: Promise<{ orderNumber: string }> }

const schema = z.object({
  paymentStatus: z.enum(['PENDING','PAID','PARTIALLY_REFUNDED','REFUNDED','VOIDED','FAILED']).optional(),
  fulfillmentStatus: z.enum(['UNFULFILLED','PARTIALLY_FULFILLED','FULFILLED','RESTOCKED']).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params
  const num = parseInt(orderNumber, 10)
  if (isNaN(num)) return err('Invalid order number', 400)

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const order = await prisma.order.findUnique({ where: { orderNumber: num } })
    if (!order) return err('Order not found', 404)

    if (parsed.data.paymentStatus) {
      await updatePaymentStatus(order.id, parsed.data.paymentStatus as PaymentStatus)
    }
    if (parsed.data.fulfillmentStatus) {
      await updateFulfillmentStatus(order.id, parsed.data.fulfillmentStatus as FulfillmentStatus)
    }

    const updated = await prisma.order.findUnique({
      where: { id: order.id },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 5 } },
    })
    return ok(updated)
  } catch (e) {
    console.error('[PATCH /api/orders/[orderNumber]/status]', e)
    return err('Failed to update order status', 500)
  }
}
