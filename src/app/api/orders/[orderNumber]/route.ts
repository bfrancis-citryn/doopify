import { ok, err } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { getOrder } from '@/server/services/order.service'

interface Params { params: Promise<{ orderNumber: string }> }

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params
  const num = parseInt(orderNumber, 10)
  if (isNaN(num)) return err('Invalid order number', 400)

  try {
    const order = await getOrder(num)
    if (!order) return err('Order not found', 404)
    return ok(order)
  } catch (e) {
    console.error('[GET /api/orders/[orderNumber]]', e)
    return err('Failed to fetch order', 500)
  }
}
