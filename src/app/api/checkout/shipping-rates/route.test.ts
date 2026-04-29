import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCheckoutShippingRates: vi.fn(),
}))

vi.mock('@/server/services/checkout.service', () => ({
  getCheckoutShippingRates: mocks.getCheckoutShippingRates,
}))

import { POST } from './route'

const validPayload = {
  items: [{ variantId: 'variant_1', quantity: 1 }],
  shippingAddress: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    address1: '1 Compute Way',
    city: 'London',
    postalCode: 'N1 1AA',
    country: 'GB',
  },
}

describe('POST /api/checkout/shipping-rates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 422 when payload validation fails', async () => {
    const response = await POST(
      new Request('http://localhost/api/checkout/shipping-rates', {
        method: 'POST',
        body: JSON.stringify({
          ...validPayload,
          items: [{ variantId: '', quantity: 0 }],
        }),
      })
    )

    expect(response.status).toBe(422)
    expect(mocks.getCheckoutShippingRates).not.toHaveBeenCalled()
  })

  it('returns normalized shipping quotes', async () => {
    mocks.getCheckoutShippingRates.mockResolvedValue({
      currency: 'USD',
      quotes: [
        {
          id: 'manual:fallback:domestic',
          source: 'MANUAL',
          displayName: 'Domestic shipping',
          amountCents: 999,
          amount: 9.99,
          currency: 'USD',
        },
      ],
    })

    const response = await POST(
      new Request('http://localhost/api/checkout/shipping-rates', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        currency: 'USD',
        quotes: [
          {
            source: 'MANUAL',
            amountCents: 999,
            amount: 9.99,
          },
        ],
      },
    })
  })
})
