import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
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

import { getStorefrontProductByHandle, getStorefrontProducts } from './product.service'

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
