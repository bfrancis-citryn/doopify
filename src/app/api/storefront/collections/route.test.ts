import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStorefrontCollectionSummaries: vi.fn(),
}))

vi.mock('@/server/services/collection.service', () => ({
  getStorefrontCollectionSummaries: mocks.getStorefrontCollectionSummaries,
}))

import { GET } from './route'

describe('GET /api/storefront/collections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns storefront-safe collection summaries', async () => {
    mocks.getStorefrontCollectionSummaries.mockResolvedValue([
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

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      data: [
        {
          id: 'col_1',
          title: 'Featured',
          handle: 'featured',
          description: 'Public goods',
          imageUrl: '/api/media/asset_1',
          sortOrder: 'MANUAL',
          updatedAt: '2026-04-26T00:00:00.000Z',
          productCount: 3,
        },
      ],
    })
  })
})
