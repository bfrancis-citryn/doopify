import { ok, err } from '@/lib/api'
import { getProductByHandle } from '@/server/services/product.service'

interface Params { params: Promise<{ handle: string }> }

// Public — no auth required
export async function GET(_req: Request, { params }: Params) {
  const { handle } = await params
  try {
    const product = await getProductByHandle(handle)
    if (!product) return err('Product not found', 404)
    return ok(product)
  } catch (e) {
    console.error('[GET /api/storefront/products/[handle]]', e)
    return err('Failed to fetch product', 500)
  }
}
