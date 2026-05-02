import { describe, expect, it } from 'vitest'
import { transformApiProductSummary } from '../lib/productUtils'

describe('transformApiProductSummary', () => {
  const minimalSummary = {
    id: 'prod-1',
    title: 'Test Shirt',
    handle: 'test-shirt',
    status: 'ACTIVE',
    vendor: 'Acme',
    productType: 'Tops',
    tags: ['new'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    publishedAt: null,
    variants: [
      { id: 'var-1', price: 29.99, compareAtPrice: null, sku: 'SHIRT-1', inventory: 10 },
    ],
    media: [],
    options: [],
  }

  it('produces a valid catalog shape from a summary with no media', () => {
    const result = transformApiProductSummary(minimalSummary)

    expect(result.id).toBe('prod-1')
    expect(result.title).toBe('Test Shirt')
    expect(result.handle).toBe('test-shirt')
    expect(result.status).toBe('active')
    expect(result.category).toBe('Tops')
    expect(result.sku).toBe('SHIRT-1')
    expect(result.basePrice).toBe('29.99')
    expect(result.options).toEqual([])
    expect(result.images).toEqual([])
    expect(result.featuredImageId).toBeNull()
  })

  it('derives inventory summary from summary variants', () => {
    const result = transformApiProductSummary(minimalSummary)

    expect(result.inventorySummary.totalAvailable).toBe(10)
    expect(result.inventorySummary.outOfStock).toBe(false)
  })

  it('maps featured media asset to the images array', () => {
    const withMedia = {
      ...minimalSummary,
      media: [
        {
          id: 'media-1',
          isFeatured: true,
          position: 0,
          assetId: 'asset-1',
          asset: { id: 'asset-1', url: '/api/media/asset-1', altText: 'A shirt' },
        },
      ],
    }

    const result = transformApiProductSummary(withMedia)

    expect(result.images).toHaveLength(1)
    expect(result.images[0].src).toBe('/api/media/asset-1')
    expect(result.images[0].alt).toBe('A shirt')
    expect(result.featuredImageId).toBe('media-1')
  })

  it('does not throw when called with empty variants and no media', () => {
    const empty = {
      ...minimalSummary,
      variants: [],
      media: [],
    }

    expect(() => transformApiProductSummary(empty)).not.toThrow()
    const result = transformApiProductSummary(empty)
    expect(result.basePrice).toBe('0.00')
    expect(result.inventorySummary.totalAvailable).toBe(0)
    expect(result.inventorySummary.outOfStock).toBe(true)
  })

  it('does not throw when options field is absent from the payload', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { options: _omitted, ...noOptions } = minimalSummary

    expect(() => transformApiProductSummary(noOptions)).not.toThrow()
    expect(transformApiProductSummary(noOptions).options).toEqual([])
  })
})
