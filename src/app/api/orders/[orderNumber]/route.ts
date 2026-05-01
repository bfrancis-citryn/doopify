import { ok, err } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  OrderIdentifierResolutionError,
  resolveOrderIdentifier,
} from '@/server/services/order-identifier.service'
import { getOrder } from '@/server/services/order.service'

interface Params { params: Promise<{ orderNumber: string }> }

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params

  try {
    const resolvedOrder = await resolveOrderIdentifier(orderNumber)
    const order = await getOrder(resolvedOrder.orderNumber)
    if (!order) return err('Order not found', 404)
    return ok(order)
  } catch (e) {
    if (e instanceof OrderIdentifierResolutionError) {
      return err(e.message, e.code === 'INVALID_IDENTIFIER' ? 400 : 404)
    }
    console.error('[GET /api/orders/[orderNumber]]', e)
    return err('Failed to fetch order', 500)
  }
}
