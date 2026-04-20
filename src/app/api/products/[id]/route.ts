import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { getProduct, updateProduct, archiveProduct } from '@/server/services/product.service'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  try {
    const product = await getProduct(id)
    if (!product) return err('Product not found', 404)
    return ok(product)
  } catch (e) {
    console.error('[GET /api/products/[id]]', e)
    return err('Failed to fetch product', 500)
  }
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  handle: z.string().optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  description: z.string().optional(),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const product = await updateProduct(id, parsed.data)
    return ok(product)
  } catch (e) {
    console.error('[PATCH /api/products/[id]]', e)
    return err('Failed to update product', 500)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  try {
    await archiveProduct(id)
    return ok({ message: 'Product archived' })
  } catch (e) {
    console.error('[DELETE /api/products/[id]]', e)
    return err('Failed to archive product', 500)
  }
}
