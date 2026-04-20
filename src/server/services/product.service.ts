import { prisma } from '@/lib/prisma'
import type { ProductStatus, Prisma } from '@prisma/client'

// ── List products ─────────────────────────────────────────────────────────────
export async function getProducts(params: {
  status?: ProductStatus
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}) {
  const { status, search, page = 1, pageSize = 20, sortBy = 'createdAt', sortDir = 'desc' } = params

  const where: Prisma.ProductWhereInput = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
      ],
    }),
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        variants: { orderBy: { position: 'asc' } },
        media: {
          include: { asset: true },
          orderBy: { position: 'asc' },
        },
        options: {
          include: { values: { orderBy: { position: 'asc' } } },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ])

  return {
    products,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

// ── Get single product ────────────────────────────────────────────────────────
export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { position: 'asc' } },
      media: {
        include: { asset: true },
        orderBy: { position: 'asc' },
      },
      options: {
        include: { values: { orderBy: { position: 'asc' } } },
        orderBy: { position: 'asc' },
      },
    },
  })
}

// ── Get product by handle (storefront) ───────────────────────────────────────
export async function getProductByHandle(handle: string) {
  return prisma.product.findUnique({
    where: { handle, status: 'ACTIVE' },
    include: {
      variants: { orderBy: { position: 'asc' } },
      media: {
        include: { asset: true },
        orderBy: { position: 'asc' },
      },
      options: {
        include: { values: { orderBy: { position: 'asc' } } },
        orderBy: { position: 'asc' },
      },
    },
  })
}

// ── Create product ────────────────────────────────────────────────────────────
export async function createProduct(data: {
  title: string
  handle?: string
  status?: ProductStatus
  description?: string
  vendor?: string
  productType?: string
  tags?: string[]
  variants?: Array<{
    title: string
    sku?: string
    price: number
    compareAtPrice?: number
    inventory?: number
  }>
}) {
  const handle = data.handle ?? slugify(data.title)

  return prisma.product.create({
    data: {
      title: data.title,
      handle,
      status: data.status ?? 'DRAFT',
      description: data.description,
      vendor: data.vendor,
      productType: data.productType,
      tags: data.tags ?? [],
      variants: data.variants
        ? {
            create: data.variants.map((v, i) => ({
              title: v.title,
              sku: v.sku,
              price: v.price,
              compareAtPrice: v.compareAtPrice,
              inventory: v.inventory ?? 0,
              position: i,
            })),
          }
        : {
            create: [{ title: 'Default Title', price: 0, inventory: 0, position: 0 }],
          },
    },
    include: {
      variants: true,
      media: { include: { asset: true } },
      options: { include: { values: true } },
    },
  })
}

// ── Update product ────────────────────────────────────────────────────────────
export async function updateProduct(
  id: string,
  data: Partial<{
    title: string
    handle: string
    status: ProductStatus
    description: string
    vendor: string
    productType: string
    tags: string[]
  }>
) {
  return prisma.product.update({
    where: { id },
    data,
    include: {
      variants: { orderBy: { position: 'asc' } },
      media: { include: { asset: true }, orderBy: { position: 'asc' } },
      options: { include: { values: true }, orderBy: { position: 'asc' } },
    },
  })
}

// ── Update variant ────────────────────────────────────────────────────────────
export async function updateVariant(
  id: string,
  data: Partial<{
    title: string
    sku: string
    price: number
    compareAtPrice: number
    inventory: number
    weight: number
  }>
) {
  return prisma.productVariant.update({ where: { id }, data })
}

// ── Decrement inventory atomically (prevents overselling) ────────────────────
export async function decrementInventory(variantId: string, quantity: number) {
  const updated = await prisma.productVariant.updateMany({
    where: { id: variantId, inventory: { gte: quantity } },
    data: { inventory: { decrement: quantity } },
  })

  if (updated.count === 0) {
    throw new Error(`Insufficient inventory for variant ${variantId}`)
  }

  return updated
}

// ── Soft delete (archive) ─────────────────────────────────────────────────────
export async function archiveProduct(id: string) {
  return prisma.product.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  })
}

// ── Public storefront: active products only ───────────────────────────────────
export async function getStorefrontProducts(params: {
  collectionHandle?: string
  search?: string
  page?: number
  pageSize?: number
}) {
  const { search, page = 1, pageSize = 24 } = params

  const where: Prisma.ProductWhereInput = {
    status: 'ACTIVE',
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        variants: { where: { inventory: { gt: 0 } }, orderBy: { position: 'asc' } },
        media: { include: { asset: true }, orderBy: { position: 'asc' }, take: 2 },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ])

  return { products, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
}

// ── Utility: generate URL slug from title ─────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
