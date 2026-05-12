import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getOrderShippingRatesForLabel: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/shipping/shipping-label.service', () => ({
  getOrderShippingRatesForLabel: mocks.getOrderShippingRatesForLabel,
}))

import { POST } from './route'

const validPayload = {
  provider: 'EASYPOST',
  items: [{ orderItemId: 'oi_1', quantity: 1 }],
  parcel: { weightOz: 12, lengthIn: 10, widthIn: 8, heightIn: 4 },
}

const validPayloadWithoutProvider = {
  items: [{ orderItemId: 'oi_1', quantity: 1 }],
  parcel: { weightOz: 12, lengthIn: 10, widthIn: 8, heightIn: 4 },
}

describe('POST /api/orders/[orderNumber]/shipping-rates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires admin authorization', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/orders/1001/shipping-rates', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      }),
      { params: Promise.resolve({ orderNumber: '1001' }) }
    )

    expect(response.status).toBe(401)
    expect(mocks.getOrderShippingRatesForLabel).not.toHaveBeenCalled()
  })

  it('returns normalized label rates', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'user_1', role: 'OWNER' },
    })
    mocks.getOrderShippingRatesForLabel.mockResolvedValue({
      provider: 'EASYPOST',
      source: 'EASYPOST',
      currency: 'USD',
      quotes: [
        {
          id: 'rate_1',
          source: 'EASYPOST',
          displayName: 'USPS Priority',
          amountCents: 642,
          currency: 'USD',
          providerRateId: 'rate_1',
        },
      ],
    })

    const response = await POST(
      new Request('http://localhost/api/orders/1001/shipping-rates', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      }),
      { params: Promise.resolve({ orderNumber: '1001' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.getOrderShippingRatesForLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: 1001,
        provider: 'EASYPOST',
      })
    )
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        provider: 'EASYPOST',
        source: 'EASYPOST',
        quotes: [{ providerRateId: 'rate_1', amountCents: 642 }],
      },
    })
  })

  it('falls back to store default provider when provider override is not supplied', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'user_1', role: 'OWNER' },
    })
    mocks.getOrderShippingRatesForLabel.mockResolvedValue({
      provider: 'SHIPPO',
      source: 'SHIPPO',
      currency: 'USD',
      quotes: [],
    })

    const response = await POST(
      new Request('http://localhost/api/orders/1001/shipping-rates', {
        method: 'POST',
        body: JSON.stringify(validPayloadWithoutProvider),
      }),
      { params: Promise.resolve({ orderNumber: '1001' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.getOrderShippingRatesForLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: 1001,
        provider: undefined,
      })
    )
  })
})

