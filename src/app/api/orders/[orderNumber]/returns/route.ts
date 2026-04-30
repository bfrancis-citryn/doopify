import { z } from 'zod'

import { err, ok, parseBody } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { prisma } from '@/lib/prisma'
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
  const num = parseInt(orderNumber, 10)
  if (isNaN(num)) return err('Invalid order number', 400)

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: num },
      select: { id: true },
    })
    if (!order) return err('Order not found', 404)

    const summary = await getOrderAdjustmentSummary(order.id)
    return ok(summary.returns)
  } catch (e) {
    console.error('[GET /api/orders/[orderNumber]/returns]', e)
    return err('Failed to fetch returns', 500)
  }
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params
  const num = parseInt(orderNumber, 10)
  if (isNaN(num)) return err('Invalid order number', 400)

  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = createReturnSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: num },
      select: { id: true },
    })
    if (!order) return err('Order not found', 404)

    const returnRecord = await createReturnRecord(order.id, parsed.data)
    return ok(returnRecord, 201)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create return'
    console.error('[POST /api/orders/[orderNumber]/returns]', e)
    return err(message, 400)
  }
}
