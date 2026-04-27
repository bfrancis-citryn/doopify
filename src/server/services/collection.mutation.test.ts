import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    collection: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  tx: {
    collection: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    collectionProduct: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

import { createCollection, deleteCollection, updateCollection } from './collection.service'

function buildAdminCollection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'col_1',
    title: 'Spring Drop',
    handle: 'spring-drop',
    description: 'Seasonal picks',
    imageUrl: null,
    sortOrder: 'MANUAL',
    isAutomated: false,
    isPublished: true,
    conditions: null,
    createdAt: new Date('2026-04-26T00:00:00.000Z'),
    updatedAt: new Date('2026-04-26T00:00:00.000Z'),
    _count: { products: 2 },
    products: [
      {
        productId: 'prod_2',
        position: 0,
        product: {
          id: 'prod_2',
          title: 'Second Product',
          handle: 'second-product',
          status: 'ACTIVE',
          vendor: 'Acme',
          media: [],
        },
      },
      {
        productId: 'prod_1',
        position: 1,
        product: {
          id: 'prod_1',
          title: 'First Product',
          handle: 'first-product',
          status: 'ACTIVE',
          vendor: 'Acme',
          media: [],
        },
      },
    ],
    ...overrides,
  }
}

describe('collection mutation service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) =>
      callback(mocks.tx)
    )
    mocks.prisma.collection.findUnique.mockResolvedValue(null)
    mocks.tx.collection.create.mockResolvedValue({ id: 'col_1' })
    mocks.tx.collection.update.mockResolvedValue({ id: 'col_1' })
    mocks.tx.collection.findUnique.mockResolvedValue(buildAdminCollection())
    mocks.tx.product.findMany.mockResolvedValue([{ id: 'prod_1' }, { id: 'prod_2' }])
    mocks.tx.collectionProduct.deleteMany.mockResolvedValue({ count: 2 })
    mocks.tx.collectionProduct.createMany.mockResolvedValue({ count: 2 })
  })

  it('creates collections with de-duplicated ordered product assignments and publish state', async () => {
    mocks.tx.collection.findUnique.mockResolvedValueOnce(
      buildAdminCollection({
        isPublished: false,
      })
    )

    const created = await createCollection({
      title: 'Spring Drop',
      isPublished: false,
      sortOrder: 'TITLE_ASC',
      productIds: ['prod_2', 'prod_1', 'prod_2'],
    })

    expect(mocks.tx.collection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Spring Drop',
        handle: 'spring-drop',
        isPublished: false,
        sortOrder: 'TITLE_ASC',
      }),
      select: { id: true },
    })
    expect(mocks.tx.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['prod_2', 'prod_1'] } },
      select: { id: true },
    })
    expect(mocks.tx.collectionProduct.createMany).toHaveBeenCalledWith({
      data: [
        { collectionId: 'col_1', productId: 'prod_2', position: 0 },
        { collectionId: 'col_1', productId: 'prod_1', position: 1 },
      ],
    })
    expect(created).toMatchObject({
      id: 'col_1',
      isPublished: false,
      productIds: ['prod_2', 'prod_1'],
    })
  })

  it('appends a numeric suffix when the requested handle is already taken', async () => {
    mocks.prisma.collection.findUnique
      .mockResolvedValueOnce({ id: 'existing_collection' })
      .mockResolvedValueOnce(null)

    await createCollection({
      title: 'Spring Drop',
    })

    expect(mocks.tx.collection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        handle: 'spring-drop-2',
      }),
      select: { id: true },
    })
  })

  it('updates publish state, normalizes sort order, and re-syncs products in input order', async () => {
    mocks.tx.collection.findUnique.mockResolvedValueOnce(
      buildAdminCollection({
        handle: 'featured-picks',
        isPublished: false,
        products: [
          {
            productId: 'prod_1',
            position: 0,
            product: {
              id: 'prod_1',
              title: 'First Product',
              handle: 'first-product',
              status: 'ACTIVE',
              vendor: 'Acme',
              media: [],
            },
          },
          {
            productId: 'prod_2',
            position: 1,
            product: {
              id: 'prod_2',
              title: 'Second Product',
              handle: 'second-product',
              status: 'ACTIVE',
              vendor: 'Acme',
              media: [],
            },
          },
        ],
      })
    )

    const updated = await updateCollection('col_1', {
      handle: 'Featured Picks',
      description: '',
      imageUrl: '',
      sortOrder: 'UNKNOWN_SORT',
      isPublished: false,
      productIds: ['prod_1', 'prod_2', 'prod_1'],
    })

    expect(mocks.tx.collection.update).toHaveBeenCalledWith({
      where: { id: 'col_1' },
      data: {
        handle: 'featured-picks',
        description: null,
        imageUrl: null,
        sortOrder: 'MANUAL',
        isPublished: false,
      },
    })
    expect(mocks.tx.collectionProduct.createMany).toHaveBeenCalledWith({
      data: [
        { collectionId: 'col_1', productId: 'prod_1', position: 0 },
        { collectionId: 'col_1', productId: 'prod_2', position: 1 },
      ],
    })
    expect(updated).toMatchObject({
      id: 'col_1',
      handle: 'featured-picks',
      productIds: ['prod_1', 'prod_2'],
    })
  })

  it('rejects collection assignment when one or more products do not exist', async () => {
    mocks.tx.product.findMany.mockResolvedValue([{ id: 'prod_1' }])

    await expect(
      createCollection({
        title: 'Broken Assignment',
        productIds: ['prod_1', 'missing_prod'],
      })
    ).rejects.toThrow('One or more products could not be found')

    expect(mocks.tx.collectionProduct.createMany).not.toHaveBeenCalled()
  })

  it('deletes collections through the Prisma delete path', async () => {
    mocks.prisma.collection.delete.mockResolvedValue({
      id: 'col_1',
      handle: 'spring-drop',
    })

    const deleted = await deleteCollection('col_1')

    expect(mocks.prisma.collection.delete).toHaveBeenCalledWith({
      where: { id: 'col_1' },
      select: { id: true, handle: true },
    })
    expect(deleted).toEqual({
      id: 'col_1',
      handle: 'spring-drop',
    })
  })
})
