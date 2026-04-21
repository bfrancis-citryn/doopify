import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ok, err, parseBody } from '@/lib/api'
import { getProducts, createProduct, upsertOptions } from '@/server/services/product.service'
import type { ProductStatus } from '@prisma/client'

const optionValueSchema = z.object({
  value: z.string().min(1),
  position: z.number().int().optional(),
})

const optionSchema = z.object({
  name: z.string().min(1),
  position: z.number().int().optional(),
  values: z.array(optionValueSchema).min(1),
})

const variantSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  sku: z.string().optional(),
  price: z.number().min(0),
  compareAtPrice: z.number().optional(),
  inventory: z.number().int().min(0).optional(),
  weight: z.number().optional(),
  weightUnit: z.string().optional(),
  position: z.number().int().optional(),
})

const mediaSchema = z.object({
  assetId: z.string().min(1),
  position: z.number().int().optional(),
  isFeatured: z.boolean().optional(),
})

const createSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  handle: z.string().optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  description: z.string().optional(),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  variants: z.array(variantSchema).optional(),
  options: z.array(optionSchema).optional(),
  media: z.array(mediaSchema).optional(),
})

function revalidateProductPaths(handle?: string) {
  revalidatePath('/')
  revalidatePath('/shop')
  revalidatePath('/api/storefront/products')

  if (handle) {
    revalidatePath(`/shop/${handle}`)
    revalidatePath(`/api/storefront/products/${handle}`)
  }
}

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

export async function POST(req: Request) {
  const body = await parseBody(req)
  if (!body) return err('Invalid request body')

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  try {
    const { options, variants, media, ...productFields } = parsed.data
    let product = await createProduct({
      ...productFields,
      variants: variants?.map((variant) => ({
        title: variant.title,
        sku: variant.sku,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        inventory: variant.inventory,
        weight: variant.weight,
        weightUnit: variant.weightUnit,
        position: variant.position,
      })),
      media,
    })

    if (options?.length) {
      product = await upsertOptions(product.id, options)
    }

    if (!product) {
      return err('Failed to create product', 500)
    }

    revalidateProductPaths(product.handle)
    return ok(product, 201)
  } catch (e: unknown) {
    console.error('[POST /api/products]', e)
    return err('Failed to create product', 500)
  }
}
