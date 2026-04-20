import { ok, err } from '@/lib/api'
import { getOrders } from '@/server/services/order.service'
import type { OrderStatus, PaymentStatus, FulfillmentStatus } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const result = await getOrders({
      status: (searchParams.get('status') as OrderStatus) || undefined,
      paymentStatus: (searchParams.get('paymentStatus') as PaymentStatus) || undefined,
      fulfillmentStatus: (searchParams.get('fulfillmentStatus') as FulfillmentStatus) || undefined,
      search: searchParams.get('search') || undefined,
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 20),
    })
    return ok(result)
  } catch (e) {
    console.error('[GET /api/orders]', e)
    return err('Failed to fetch orders', 500)
  }
}
