import { err, ok } from '@/lib/api'
import { getPublicStorefrontSettings } from '@/server/services/settings.service'

export async function GET() {
  try {
    const store = await getPublicStorefrontSettings()
    if (!store) return err('Store not configured', 404)
    return ok(store)
  } catch (e) {
    console.error('[GET /api/storefront/settings]', e)
    return err('Failed to fetch storefront settings', 500)
  }
}
