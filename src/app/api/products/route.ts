import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { getProducts, createProduct } from '@/server/services/product.service'
import type { ProductStatus } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const result = await getProducts({
      status: (searchParams.get('status') as ProductStatus) || undefined,
      search: searchParams.get('search') || undefined,
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 20),
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortDir: (searchParams.get('sortDir') as 'asc' | 'desc') || 'desc',
    })
    return ok(result)
  } catch (e: unknown) {
    console.error('[GET /api/products]', e)
    return err('Failed to fetch products', 500)
  }
}

const createSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  handle: z.string().optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  description: z.string().optional(),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  variants: z
    .array(
      z.object({
        title: z.string(),
        sku: z.string().optional(),
        price: z.number().min(0),
        compareAtPrice: z.number().optional(),
        inventory: z.number().int().min(0).optional(),
      })
    )
    .optional(),
})

export async function POST(req: Request) {
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const product = await createProduct(parsed.data)
    return ok(product, 201)
  } catch (e: unknown) {
    console.error('[POST /api/products]', e)
    return err('Failed to create product', 500)
  }
}
