import { ok, err } from '@/lib/api'
import { getStorefrontProductByHandle } from '@/server/services/product.service'

// Public — no auth required
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const product = await getStorefrontProductByHandle(handle)
    if (!product) return err('Product not found', 404)
    return ok(product)
  } catch (e) {
    console.error('[GET /api/storefront/products/[handle]]', e)
    return err('Failed to fetch product', 500)
  }
}
