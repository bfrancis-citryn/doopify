import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { getAdminOrderDetailByOrderNumber } from '@/server/services/admin-order-detail.service'
import {
  OrderIdentifierResolutionError,
  resolveOrderIdentifier,
} from '@/server/services/order-identifier.service'

interface Params {
  params: Promise<{ orderNumber: string }>
}

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { orderNumber } = await params

  try {
    const resolvedOrder = await resolveOrderIdentifier(orderNumber)
    const detail = await getAdminOrderDetailByOrderNumber(resolvedOrder.orderNumber)
    if (!detail) return err('Order not found', 404)
    return ok(detail)
  } catch (error) {
    if (error instanceof OrderIdentifierResolutionError) {
      return err(error.message, error.code === 'INVALID_IDENTIFIER' ? 400 : 404)
    }
    console.error('[GET /api/orders/[orderNumber]/detail]', error)
    return err('Failed to fetch order detail', 500)
  }
}
