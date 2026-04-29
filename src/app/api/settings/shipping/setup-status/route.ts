import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  buildShippingSetupStatus,
  getShippingSetupStore,
} from '@/server/shipping/shipping-setup.service'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const store = await getShippingSetupStore()
    if (!store) return err('Store not configured', 404)

    const status = await buildShippingSetupStatus(store)
    return ok(status)
  } catch (error) {
    console.error('[GET /api/settings/shipping/setup-status]', error)
    return err('Failed to load shipping setup status', 500)
  }
}
