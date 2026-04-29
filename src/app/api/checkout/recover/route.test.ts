import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  recoverCheckoutByToken: vi.fn(),
}))

vi.mock('@/server/services/abandoned-checkout.service', () => ({
  recoverCheckoutByToken: mocks.recoverCheckoutByToken,
}))

import { GET } from './route'

describe('GET /api/checkout/recover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects missing token', async () => {
    const response = await GET(new Request('http://localhost/api/checkout/recover'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'token is required',
    })
  })

  it('rejects invalid token', async () => {
    mocks.recoverCheckoutByToken.mockResolvedValue({ ok: false, reason: 'INVALID_TOKEN' })

    const response = await GET(new Request('http://localhost/api/checkout/recover?token=bad-token'))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid recovery token',
    })
  })

  it('returns safe recovery payload for valid token', async () => {
    mocks.recoverCheckoutByToken.mockResolvedValue({
      ok: true,
      checkout: {
        id: 'checkout_1',
        email: 'customer@example.com',
        currency: 'USD',
        status: 'PENDING',
        items: [{ variantId: 'variant_1', productId: 'product_1', title: 'Tee', quantity: 1, price: 25, priceCents: 2500 }],
        shippingAddress: { address1: '1 Main', city: 'SF', postalCode: '94103', country: 'US' },
        billingAddress: { address1: '1 Main', city: 'SF', postalCode: '94103', country: 'US' },
        pricing: {
          subtotal: 25,
          shippingAmount: 9.99,
          taxAmount: 0,
          discountAmount: 0,
          total: 34.99,
          subtotalCents: 2500,
          shippingAmountCents: 999,
          taxAmountCents: 0,
          discountAmountCents: 0,
          totalCents: 3499,
        },
      },
    })

    const response = await GET(new Request('http://localhost/api/checkout/recover?token=valid-token'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toEqual(expect.objectContaining({
      id: 'checkout_1',
      email: 'customer@example.com',
      pricing: expect.objectContaining({ totalCents: 3499 }),
    }))
    expect(JSON.stringify(payload.data)).not.toContain('"payload"')
    expect(JSON.stringify(payload.data)).not.toContain('paymentIntentId')
  })
})
