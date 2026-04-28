import { z } from 'zod'

import { err, getToken, ok, parseBody } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
  const token = getToken(req)
  if (!token || !(await verifyToken(token))) return err('Unauthorized', 401)

  const { orderNumber } = await params
  const num = parseInt(orderNumber, 10)
  if (isNaN(num)) return err('Invalid order number', 400)

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: num },
      select: { id: true },
    })
    if (!order) return err('Order not found', 404)

    const refunds = await getOrderRefunds(order.id)
    return ok(refunds)
  } catch (e) {
    console.error('[GET /api/orders/[orderNumber]/refunds]', e)
    return err('Failed to fetch refunds', 500)
  }
}

export async function POST(req: Request, { params }: Params) {
  const token = getToken(req)
  if (!token || !(await verifyToken(token))) return err('Unauthorized', 401)

  const { orderNumber } = await params
  const num = parseInt(orderNumber, 10)
  if (isNaN(num)) return err('Invalid order number', 400)

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = issueRefundSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: num },
      select: { id: true },
    })
    if (!order) return err('Order not found', 404)

    const refund = await issueRefund({ orderId: order.id, ...parsed.data })
    return ok(refund, 201)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to issue refund'
    console.error('[POST /api/orders/[orderNumber]/refunds]', e)
    return err(message, 500)
  }
}
