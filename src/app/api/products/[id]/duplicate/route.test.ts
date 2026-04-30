import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  duplicateProduct: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/services/product.service', () => ({
  duplicateProduct: mocks.duplicateProduct,
}))

import { POST } from './route'

describe('POST /api/products/[id]/duplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({ ok: true })
  })

  it('returns 404 when source product is missing', async () => {
    mocks.duplicateProduct.mockResolvedValue(null)

    const response = await POST(new Request('http://localhost/api/products/prod_1/duplicate', { method: 'POST' }), {
      params: Promise.resolve({ id: 'prod_1' }),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Product not found',
    })
  })

  it('duplicates and revalidates storefront paths', async () => {
    mocks.duplicateProduct.mockResolvedValue({
      id: 'prod_copy',
      handle: 'alpha-copy',
    })

    const response = await POST(new Request('http://localhost/api/products/prod_1/duplicate', { method: 'POST' }), {
      params: Promise.resolve({ id: 'prod_1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toEqual({
      success: true,
      data: {
        id: 'prod_copy',
        handle: 'alpha-copy',
      },
    })
    expect(mocks.duplicateProduct).toHaveBeenCalledWith('prod_1')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/shop')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/api/storefront/products')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/shop/alpha-copy')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/api/storefront/products/alpha-copy')
  })
})
