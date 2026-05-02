import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
  emitInternalEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/server/events/dispatcher', () => ({
  emitInternalEvent: mocks.emitInternalEvent,
}))

import { getStorefrontProductByHandle, getStorefrontProducts, getProductSummaries, getProduct } from './product.service'

describe('getProductSummaries — lightweight list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries with select (not include) so options and full media are excluded', async () => {
    mocks.prisma.product.findMany.mockResolvedValue([])
    mocks.prisma.product.count.mockResolvedValue(0)

    await getProductSummaries({ page: 1, pageSize: 20 })

    const callArg = mocks.prisma.product.findMany.mock.calls[0][0]
    expect(callArg).toHaveProperty('select')
    expect(callArg).not.toHaveProperty('include')
    expect(callArg.select).not.toHaveProperty('options')
  })

  it('summary select includes variants and only the featured media item', async () => {
    mocks.prisma.product.findMany.mockResolvedValue([])
    mocks.prisma.product.count.mockResolvedValue(0)

    await getProductSummaries({ page: 1, pageSize: 20 })

    const select = mocks.prisma.product.findMany.mock.calls[0][0].select
    expect(select).toHaveProperty('variants')
    expect(select).toHaveProperty('media')
    expect(select.media).toMatchObject({ where: { isFeatured: true }, take: 1 })
  })

  it('converts variant priceCents to dollars and sets options: [] in the response', async () => {
    mocks.prisma.product.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        title: 'Test Product',
        handle: 'test-product',
        status: 'ACTIVE',
        vendor: null,
        productType: null,
        tags: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        publishedAt: null,
        variants: [
          { id: 'var-1', priceCents: 2999, compareAtPriceCents: null, sku: 'SKU-1', inventory: 5 },
        ],
        media: [],
      },
    ])
    mocks.prisma.product.count.mockResolvedValue(1)

    const result = await getProductSummaries({ page: 1, pageSize: 20 })

    expect(result.products).toHaveLength(1)
    expect(result.products[0].variants[0].price).toBe(29.99)
    expect(result.products[0].options).toEqual([])
    expect(result.products[0].media).toEqual([])
  })

  it('includes the computed media URL for the featured item', async () => {
    mocks.prisma.product.findMany.mockResolvedValue([
      {
        id: 'prod-2',
        title: 'With Image',
        handle: 'with-image',
        status: 'ACTIVE',
        vendor: null,
        productType: null,
        tags: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        publishedAt: null,
        variants: [],
        media: [
          {
            id: 'media-1',
            isFeatured: true,
            position: 0,
            assetId: 'asset-1',
            asset: { id: 'asset-1', altText: 'A shirt' },
          },
        ],
      },
    ])
    mocks.prisma.product.count.mockResolvedValue(1)

    const result = await getProductSummaries({ page: 1, pageSize: 20 })

    const media = result.products[0].media[0]
    expect(media.asset?.url).toBe('/api/media/asset-1')
    expect(media.asset?.altText).toBe('A shirt')
  })
})

describe('getProduct — full detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches with full include so variants, media with assets, and options are all present', async () => {
    mocks.prisma.product.findUnique.mockResolvedValue(null)

    await getProduct('prod-1')

    const callArg = mocks.prisma.product.findUnique.mock.calls[0][0]
    expect(callArg).toHaveProperty('include')
    expect(callArg.include).toHaveProperty('variants')
    expect(callArg.include).toHaveProperty('media')
    expect(callArg.include).toHaveProperty('options')
  })
})

describe('product storefront visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters storefront list to active products that are publishable now', async () => {
    mocks.prisma.product.findMany.mockResolvedValue([])
    mocks.prisma.product.count.mockResolvedValue(0)

    await getStorefrontProducts({ page: 1, pageSize: 24 })

    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          AND: expect.arrayContaining([
            { OR: [{ publishedAt: null }, { publishedAt: { lte: expect.any(Date) } }] },
          ]),
        }),
      })
    )
  })

  it('filters storefront detail lookup to active and publishable handle entries', async () => {
    mocks.prisma.product.findFirst.mockResolvedValue(null)

    await expect(getStorefrontProductByHandle('alpha')).resolves.toBeNull()

    expect(mocks.prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          handle: 'alpha',
          status: 'ACTIVE',
          OR: [{ publishedAt: null }, { publishedAt: { lte: expect.any(Date) } }],
        }),
      })
    )
  })
})
