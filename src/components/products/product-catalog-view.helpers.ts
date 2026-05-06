export const PRODUCT_CATALOG_EMPTY_STATE = {
  title: 'No products yet',
  description: 'Create your first product to start building your storefront.',
  actionLabel: 'Add first product',
} as const

export type CatalogViewState = 'loading' | 'empty' | 'filtered-empty' | 'table'

export function getCatalogViewState(input: {
  catalogLoaded: boolean
  hasDraftProduct: boolean
  totalProducts: number
  visibleProducts: number
}): CatalogViewState {
  if (!input.hasDraftProduct && !input.catalogLoaded) {
    return 'loading'
  }

  if (input.totalProducts === 0) {
    return 'empty'
  }

  if (input.visibleProducts === 0) {
    return 'filtered-empty'
  }

  return 'table'
}
