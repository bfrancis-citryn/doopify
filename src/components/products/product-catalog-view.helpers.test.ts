import { describe, expect, it } from 'vitest'

import {
  getCatalogViewState,
  PRODUCT_CATALOG_EMPTY_STATE,
} from './product-catalog-view.helpers'

describe('product catalog first-run view helpers', () => {
  it('returns no-products empty state copy and CTA for an empty loaded catalog', () => {
    const state = getCatalogViewState({
      catalogLoaded: true,
      hasDraftProduct: false,
      totalProducts: 0,
      visibleProducts: 0,
    })

    expect(state).toBe('empty')
    expect(PRODUCT_CATALOG_EMPTY_STATE.title).toBe('No products yet')
    expect(PRODUCT_CATALOG_EMPTY_STATE.description).toBe(
      'Create your first product to start building your storefront.'
    )
    expect(PRODUCT_CATALOG_EMPTY_STATE.actionLabel).toBe('Add first product')
  })

  it('stops loading skeleton after an empty response is loaded', () => {
    expect(
      getCatalogViewState({
        catalogLoaded: false,
        hasDraftProduct: false,
        totalProducts: 0,
        visibleProducts: 0,
      })
    ).toBe('loading')

    expect(
      getCatalogViewState({
        catalogLoaded: true,
        hasDraftProduct: false,
        totalProducts: 0,
        visibleProducts: 0,
      })
    ).toBe('empty')
  })

  it('keeps filter/search empty state distinct when products exist', () => {
    expect(
      getCatalogViewState({
        catalogLoaded: true,
        hasDraftProduct: false,
        totalProducts: 3,
        visibleProducts: 0,
      })
    ).toBe('filtered-empty')
  })
})
