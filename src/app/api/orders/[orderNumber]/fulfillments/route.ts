import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { createFulfillment } from '@/server/services/order.service'

interface Params { params: Promise<{ orderNumber: string }> }

const schema = z.object({
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  items: z.array(
    z.object({
      orderItemId: z.string(),
      variantId: z.string().optional(),
      quantity: z.number().int().min(1),
    })
  ).min(1, 'At least one item is required'),
})

export async function POST(req: Request, { params }: Params) {
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

    const fulfillment = await createFulfillment({ orderId: order.id, ...parsed.data })
    return ok(fulfillment, 201)
  } catch (e) {
    console.error('[POST /api/orders/[orderNumber]/fulfillments]', e)
    return err('Failed to create fulfillment', 500)
  }
}
