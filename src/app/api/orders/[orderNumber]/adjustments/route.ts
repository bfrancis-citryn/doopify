import { err, ok } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/server/auth/require-auth'
import { getOrderAdjustmentSummary } from '@/server/services/order-adjustments.service'

interface Params {
  params: Promise<{ orderNumber: string }>
}

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params
  const parsedOrderNumber = parseInt(orderNumber, 10)
  if (Number.isNaN(parsedOrderNumber)) {
    return err('Invalid order number', 400)
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: parsedOrderNumber },
      select: { id: true },
    })

    if (!order) {
      return err('Order not found', 404)
    }

    const summary = await getOrderAdjustmentSummary(order.id)
    return ok(summary)
  } catch (error) {
    console.error('[GET /api/orders/[orderNumber]/adjustments]', error)
    return err('Failed to load order adjustments', 500)
  }
}
