import { revalidatePath } from 'next/cache'
import { ok, err } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { duplicateProduct } from '@/server/services/product.service'

interface Params {
  params: Promise<{ id: string }>
}

function revalidateProductPaths(handle?: string) {
  revalidatePath('/')
  revalidatePath('/shop')
  revalidatePath('/api/storefront/products')

  if (handle) {
    revalidatePath(`/shop/${handle}`)
    revalidatePath(`/api/storefront/products/${handle}`)
  }
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const product = await duplicateProduct(id)
    if (!product) {
      return err('Product not found', 404)
    }

    revalidateProductPaths(product.handle)
    return ok(product, 201)
  } catch (e) {
    console.error('[POST /api/products/[id]/duplicate]', e)
    return err('Failed to duplicate product', 500)
  }
}
