import { prisma } from '@/lib/prisma'
import type { ProductStatus, Prisma } from '@prisma/client'

const productInclude = {
  variants: { orderBy: { position: 'asc' as const } },
  media: {
    include: { asset: true },
    orderBy: { position: 'asc' as const },
  },
  options: {
    include: { values: { orderBy: { position: 'asc' as const } } },
    orderBy: { position: 'asc' as const },
  },
} satisfies Prisma.ProductInclude

const storefrontProductInclude = {
  variants: { where: { inventory: { gt: 0 } }, orderBy: { position: 'asc' as const } },
  media: { include: { asset: true }, orderBy: { position: 'asc' as const }, take: 2 },
} satisfies Prisma.ProductInclude

type ProductVariantPayload = {
  id?: string
  title: string
  sku?: string
  price: number
  compareAtPrice?: number
  inventory?: number
  weight?: number
  weightUnit?: string
  position?: number
}

type ProductMediaPayload = {
  assetId: string
  position?: number
  isFeatured?: boolean
}

function attachMediaUrls(product: any) {
  return {
    ...product,
    media: (product.media || []).map((media: any) => ({
      ...media,
      asset: media.asset
        ? {
            ...media.asset,
            url: `/api/media/${media.asset.id}`,
          }
        : null,
    })),
  }
}

function attachMediaUrlsToList(products: any[] = []) {
  return products.map(attachMediaUrls)
}

function normalizeProductMedia(media: ProductMediaPayload[] = []) {
  const seenAssetIds = new Set<string>()

  return media.reduce<ProductMediaPayload[]>((items, mediaItem, index) => {
    const assetId = String(mediaItem?.assetId ?? '').trim()
    if (!assetId || seenAssetIds.has(assetId)) {
      return items
    }

    seenAssetIds.add(assetId)
    items.push({
      assetId,
      position: mediaItem.position ?? index,
      isFeatured: Boolean(mediaItem.isFeatured),
    })
    return items
  }, [])
}

function createFallbackVariant(variant?: Partial<ProductVariantPayload>): ProductVariantPayload {
  return {
    title: variant?.title || 'Default',
    sku: variant?.sku,
    price: variant?.price ?? 0,
    compareAtPrice: variant?.compareAtPrice,
    inventory: variant?.inventory ?? 0,
    weight: variant?.weight,
    weightUnit: variant?.weightUnit ?? 'kg',
    position: variant?.position ?? 0,
  }
}

async function syncProductVariants(
  tx: Prisma.TransactionClient,
  productId: string,
  variants: ProductVariantPayload[]
) {
  const existingVariants = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true },
  })

  const existingVariantIds = new Set(existingVariants.map((variant) => variant.id))
  const incomingExistingIds = new Set(
    variants
      .map((variant) => variant.id)
      .filter((variantId): variantId is string => Boolean(variantId && existingVariantIds.has(variantId)))
  )

  for (const [index, variant] of variants.entries()) {
    const variantData = {
      title: variant.title,
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice ?? null,
      inventory: variant.inventory ?? 0,
      weight: variant.weight ?? null,
      weightUnit: variant.weightUnit ?? 'kg',
      position: variant.position ?? index,
    }

    if (variant.id && existingVariantIds.has(variant.id)) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: variantData,
      })
      continue
    }

    await tx.productVariant.create({
      data: {
        productId,
        ...variantData,
      },
    })
  }

  const removableVariantIds = existingVariants
    .map((variant) => variant.id)
    .filter((variantId) => !incomingExistingIds.has(variantId))

  if (removableVariantIds.length) {
    await tx.productVariant.deleteMany({
      where: {
        productId,
        id: { in: removableVariantIds },
      },
    })
  }
}

async function syncProductMedia(
  tx: Prisma.TransactionClient,
  productId: string,
  media: ProductMediaPayload[]
) {
  const normalizedMedia = normalizeProductMedia(media)

  if (normalizedMedia.length) {
    const assetIds = normalizedMedia.map((mediaItem) => mediaItem.assetId)
    const assets = await tx.mediaAsset.findMany({
      where: { id: { in: assetIds } },
      select: { id: true },
    })

    if (assets.length !== assetIds.length) {
      throw new Error('One or more media assets could not be found')
    }
  }

  await tx.productMedia.deleteMany({
    where: { productId },
  })

  if (!normalizedMedia.length) {
    return
  }

  const featuredAssetId =
    normalizedMedia.find((mediaItem) => mediaItem.isFeatured)?.assetId || normalizedMedia[0].assetId

  await tx.productMedia.createMany({
    data: normalizedMedia.map((mediaItem, index) => ({
      productId,
      assetId: mediaItem.assetId,
      position: mediaItem.position ?? index,
      isFeatured: mediaItem.assetId === featuredAssetId,
    })),
  })
}

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
      include: productInclude,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ])

  return {
    products: attachMediaUrlsToList(products),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  })

  return product ? attachMediaUrls(product) : null
}

export async function getProductByHandle(handle: string) {
  const product = await prisma.product.findFirst({
    where: { handle, status: 'ACTIVE' },
    include: productInclude,
  })

  return product ? attachMediaUrls(product) : null
}

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
    weight?: number
    weightUnit?: string
    position?: number
  }>
  media?: ProductMediaPayload[]
}) {
  const handle = data.handle ?? slugify(data.title)
  const variants = data.variants?.length ? data.variants : [createFallbackVariant()]

  const product = await prisma.$transaction(async (tx) => {
    const createdProduct = await tx.product.create({
      data: {
        title: data.title,
        handle,
        status: data.status ?? 'DRAFT',
        description: data.description,
        vendor: data.vendor,
        productType: data.productType,
        tags: data.tags ?? [],
        variants: {
          create: variants.map((variant, index) => ({
            title: variant.title,
            sku: variant.sku,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
            inventory: variant.inventory ?? 0,
            weight: variant.weight,
            weightUnit: variant.weightUnit,
            position: variant.position ?? index,
          })),
        },
      },
      select: { id: true },
    })

    if (data.media) {
      await syncProductMedia(tx, createdProduct.id, data.media)
    }

    return tx.product.findUnique({
      where: { id: createdProduct.id },
      include: productInclude,
    })
  })

  return product ? attachMediaUrls(product) : null
}

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
    variants: ProductVariantPayload[]
    media: ProductMediaPayload[]
  }>
) {
  const { variants, media, ...productFields } = data

  const product = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: productFields,
    })

    if (variants) {
      await syncProductVariants(tx, id, variants.length ? variants : [createFallbackVariant()])
    }

    if (media) {
      await syncProductMedia(tx, id, media)
    }

    return tx.product.findUnique({
      where: { id },
      include: productInclude,
    })
  })

  return product ? attachMediaUrls(product) : null
}

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

export async function createVariant(
  productId: string,
  data: {
    title: string
    sku?: string
    price: number
    compareAtPrice?: number
    inventory?: number
    weight?: number
    weightUnit?: string
  }
) {
  const count = await prisma.productVariant.count({ where: { productId } })
  return prisma.productVariant.create({
    data: {
      productId,
      title: data.title,
      sku: data.sku,
      price: data.price,
      compareAtPrice: data.compareAtPrice,
      inventory: data.inventory ?? 0,
      weight: data.weight,
      weightUnit: data.weightUnit,
      position: count,
    },
  })
}

export async function deleteVariant(id: string) {
  return prisma.productVariant.delete({ where: { id } })
}

export async function upsertOptions(
  productId: string,
  options: Array<{
    name: string
    position?: number
    values: Array<{ value: string; position?: number }>
  }>
) {
  const product = await prisma.$transaction(async (tx) => {
    await tx.productOption.deleteMany({ where: { productId } })

    for (const [index, option] of options.entries()) {
      await tx.productOption.create({
        data: {
          productId,
          name: option.name,
          position: option.position ?? index,
          values: {
            create: option.values.map((value, valueIndex) => ({
              value: value.value,
              position: value.position ?? valueIndex,
            })),
          },
        },
      })
    }

    return tx.product.findUnique({
      where: { id: productId },
      include: productInclude,
    })
  })

  return product ? attachMediaUrls(product) : null
}

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

export async function archiveProduct(id: string) {
  return prisma.product.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  })
}

export async function getStorefrontProducts(params: {
  collectionHandle?: string
  search?: string
  page?: number
  pageSize?: number
}) {
  const { search, page = 1, pageSize = 24 } = params

  const where: Prisma.ProductWhereInput = {
    status: 'ACTIVE',
    variants: { some: { inventory: { gt: 0 } } },
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
      include: storefrontProductInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ])

  return {
    products: attachMediaUrlsToList(products),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
