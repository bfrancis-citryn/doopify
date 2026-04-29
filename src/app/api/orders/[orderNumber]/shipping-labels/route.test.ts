import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  buyOrderShippingLabel: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/shipping/shipping-label.service', () => ({
  buyOrderShippingLabel: mocks.buyOrderShippingLabel,
}))

import { POST } from './route'

const validPayload = {
  providerRateId: 'rate_1',
  labelFormat: 'PDF',
  labelSize: '4x6',
  items: [{ orderItemId: 'oi_1', quantity: 1 }],
  parcel: { weightOz: 12, lengthIn: 10, widthIn: 8, heightIn: 4 },
}

describe('POST /api/orders/[orderNumber]/shipping-labels', () => {
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
      new Request('http://localhost/api/orders/1001/shipping-labels', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      }),
      { params: Promise.resolve({ orderNumber: '1001' }) }
    )

    expect(response.status).toBe(401)
    expect(mocks.buyOrderShippingLabel).not.toHaveBeenCalled()
  })

  it('purchases a shipping label and returns persisted payload', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'user_1', role: 'OWNER' },
    })
    mocks.buyOrderShippingLabel.mockResolvedValue({
      duplicate: false,
      shippingLabel: {
        id: 'label_1',
        orderId: 'order_1',
        labelUrl: 'https://labels.example.com/label_1.pdf',
      },
      fulfillment: {
        id: 'ful_1',
      },
    })

    const response = await POST(
      new Request('http://localhost/api/orders/1001/shipping-labels', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      }),
      { params: Promise.resolve({ orderNumber: '1001' }) }
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        duplicate: false,
        shippingLabel: {
          id: 'label_1',
        },
      },
    })
  })
})

