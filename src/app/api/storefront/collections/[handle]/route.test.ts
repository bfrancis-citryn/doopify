import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStorefrontCollectionByHandle: vi.fn(),
}))

vi.mock('@/server/services/collection.service', () => ({
  getStorefrontCollectionByHandle: mocks.getStorefrontCollectionByHandle,
}))

import { GET } from './route'

describe('GET /api/storefront/collections/[handle]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the collection is not storefront-visible', async () => {
    mocks.getStorefrontCollectionByHandle.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost/api/storefront/collections/hidden'), {
      params: Promise.resolve({ handle: 'hidden' }),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Collection not found',
    })
  })

  it('returns storefront-safe collection details', async () => {
    mocks.getStorefrontCollectionByHandle.mockResolvedValue({
      id: 'col_1',
      title: 'Featured',
      handle: 'featured',
      description: 'Public goods',
      imageUrl: '/api/media/asset_1',
      sortOrder: 'MANUAL',
      productCount: 1,
      products: [
        {
          id: 'prod_1',
          handle: 'alpha',
          title: 'Alpha',
          description: 'Alpha desc',
          vendor: 'Acme',
          productType: 'Shirt',
          media: [
            {
              id: 'media_1',
              position: 0,
              isFeatured: true,
              url: '/api/media/asset_1',
              altText: 'Alpha',
              width: 1200,
              height: 1200,
            },
          ],
          variants: [
            {
              id: 'var_1',
              title: 'Default',
              price: 25,
              compareAtPrice: null,
              inventory: 7,
              weight: null,
              weightUnit: null,
            },
          ],
        },
      ],
    })

    const response = await GET(new Request('http://localhost/api/storefront/collections/featured'), {
      params: Promise.resolve({ handle: 'featured' }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      success: true,
      data: {
        id: 'col_1',
        handle: 'featured',
        productCount: 1,
      },
    })
    expect(body.data).not.toHaveProperty('isPublished')
    expect(body.data).not.toHaveProperty('conditions')
    expect(body.data.products[0]).not.toHaveProperty('status')
  })
})
