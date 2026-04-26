import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    collection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    collectionProduct: {
      groupBy: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

import {
  getCollectionSummaries,
  getStorefrontCollectionByHandle,
  getStorefrontCollectionSummaries,
} from './collection.service'

describe('collection service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps publish state visible to admin collection summaries', async () => {
    mocks.prisma.collection.findMany.mockResolvedValue([
      {
        id: 'col_1',
        title: 'Private Drop',
        handle: 'private-drop',
        description: 'Not public yet',
        sortOrder: 'MANUAL',
        isPublished: false,
        updatedAt: new Date('2026-04-26T00:00:00.000Z'),
        _count: {
          products: 2,
        },
      },
    ])

    await expect(getCollectionSummaries()).resolves.toEqual([
      {
        id: 'col_1',
        title: 'Private Drop',
        handle: 'private-drop',
        description: 'Not public yet',
        sortOrder: 'MANUAL',
        isPublished: false,
        updatedAt: new Date('2026-04-26T00:00:00.000Z'),
        productCount: 2,
      },
    ])
  })

  it('filters storefront collection summaries to published collections with visible products', async () => {
    mocks.prisma.collection.findMany.mockResolvedValue([
      {
        id: 'col_1',
        title: 'Featured',
        handle: 'featured',
        description: 'Public goods',
        imageUrl: null,
        sortOrder: 'MANUAL',
        updatedAt: new Date('2026-04-26T00:00:00.000Z'),
        products: [
          {
            product: {
              media: [
                {
                  asset: {
                    id: 'asset_1',
                  },
                },
              ],
            },
          },
        ],
        isPublished: true,
        internalNote: 'should not leak',
      },
    ])
    mocks.prisma.collectionProduct.groupBy.mockResolvedValue([
      {
        collectionId: 'col_1',
        _count: {
          _all: 3,
        },
      },
    ])

    const summaries = await getStorefrontCollectionSummaries()

    expect(mocks.prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublished: true,
          products: expect.any(Object),
        }),
      })
    )
    expect(summaries).toEqual([
      {
        id: 'col_1',
        title: 'Featured',
        handle: 'featured',
        description: 'Public goods',
        imageUrl: '/api/media/asset_1',
        sortOrder: 'MANUAL',
        updatedAt: new Date('2026-04-26T00:00:00.000Z'),
        productCount: 3,
      },
    ])
    expect(summaries[0]).not.toHaveProperty('isPublished')
    expect(summaries[0]).not.toHaveProperty('internalNote')
  })

  it('requires storefront collection details to be published and storefront-visible', async () => {
    mocks.prisma.collection.findFirst.mockResolvedValue(null)

    await expect(getStorefrontCollectionByHandle('draft-drop')).resolves.toBeNull()
    expect(mocks.prisma.collection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          handle: 'draft-drop',
          isPublished: true,
          products: expect.any(Object),
        }),
      })
    )
  })
})
