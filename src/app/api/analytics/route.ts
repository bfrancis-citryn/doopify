import { ok, err } from '@/lib/api'
import { getAnalytics } from '@/server/services/order.service'

export async function GET() {
  try {
    const data = await getAnalytics()
    return ok(data)
  } catch (e) {
    console.error('[GET /api/analytics]', e)
    return err('Failed to fetch analytics', 500)
  }
}
