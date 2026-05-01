import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  convertDraftOrder: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/services/draft-order-conversion.service', async () => {
  const actual = await vi.importActual<typeof import('@/server/services/draft-order-conversion.service')>(
    '@/server/services/draft-order-conversion.service'
  )
  return {
    ...actual,
    convertDraftOrder: mocks.convertDraftOrder,
  }
})

import { POST } from './route'

describe('POST /api/draft-orders/convert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires admin auth', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/draft-orders/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: 'draft_1', lineItems: [] }),
      })
    )

    expect(response.status).toBe(401)
    expect(mocks.convertDraftOrder).not.toHaveBeenCalled()
  })

  it('returns 422 for invalid payload shape', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin_1', role: 'OWNER' } })

    const response = await POST(
      new Request('http://localhost/api/draft-orders/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: 'draft_1', lineItems: [] }),
      })
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      success: false,
      error: 'Draft conversion payload is invalid',
    })
  })

  it('converts valid payload and returns redirect details', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin_1', role: 'OWNER' } })
    mocks.convertDraftOrder.mockResolvedValue({
      duplicate: false,
      orderId: 'ord_1',
      orderNumber: 1010,
      redirectUrl: '/orders/1010',
    })

    const response = await POST(
      new Request('http://localhost/api/draft-orders/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: 'draft_1',
          paymentStatus: 'pending',
          lineItems: [{ title: 'Product', quantity: 1, originalPrice: 25 }],
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      success: true,
      data: {
        duplicate: false,
        orderId: 'ord_1',
        orderNumber: 1010,
        redirectUrl: '/orders/1010',
      },
    })
  })

  it('returns 422 for negative override amount', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin_1', role: 'OWNER' } })

    const response = await POST(
      new Request('http://localhost/api/draft-orders/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: 'draft_1',
          lineItems: [
            {
              title: 'Product',
              quantity: 1,
              originalPrice: 25,
              priceOverridden: true,
              priceOverrideAmount: -1,
              priceOverrideReason: 'Bad input',
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(422)
    expect(mocks.convertDraftOrder).not.toHaveBeenCalled()
  })
})
