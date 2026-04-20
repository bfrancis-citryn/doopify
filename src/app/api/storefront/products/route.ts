import { ok, err } from '@/lib/api'
import { getStorefrontProducts } from '@/server/services/product.service'

// Public — no auth required
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const result = await getStorefrontProducts({
      search: searchParams.get('search') || undefined,
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 24),
    })
    return ok(result)
  } catch (e) {
    console.error('[GET /api/storefront/products]', e)
    return err('Failed to fetch products', 500)
  }
}
