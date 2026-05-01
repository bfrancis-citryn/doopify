import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  resolveOrderIdentifier: vi.fn(),
  updateOrderNotes: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/services/order-identifier.service', () => ({
  resolveOrderIdentifier: mocks.resolveOrderIdentifier,
  OrderIdentifierResolutionError: class OrderIdentifierResolutionError extends Error {
    code: string

    constructor(message: string, code: string) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock('@/server/services/order-notes.service', () => ({
  updateOrderNotes: mocks.updateOrderNotes,
}))

import { PATCH } from './route'

describe('PATCH /api/orders/[orderNumber]/notes', () => {
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

    const response = await PATCH(
      new Request('http://localhost/api/orders/1001/notes', {
        method: 'PATCH',
        body: JSON.stringify({ internalNote: 'Priority customer' }),
      }),
      { params: Promise.resolve({ orderNumber: '1001' }) }
    )

    expect(response.status).toBe(401)
    expect(mocks.resolveOrderIdentifier).not.toHaveBeenCalled()
    expect(mocks.updateOrderNotes).not.toHaveBeenCalled()
  })

  it('updates notes for a valid payload', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'user_1', role: 'OWNER' },
    })
    mocks.resolveOrderIdentifier.mockResolvedValue({ orderId: 'order_1', orderNumber: 1001 })
    mocks.updateOrderNotes.mockResolvedValue({
      order: { id: 'order_1', note: 'Internal note' },
      emailDelivery: { attempted: true, sent: true, error: null },
    })

    const response = await PATCH(
      new Request('http://localhost/api/orders/1001/notes', {
        method: 'PATCH',
        body: JSON.stringify({
          internalNote: 'Internal note',
          customerNote: 'Customer update',
          sendCustomerEmail: true,
        }),
      }),
      { params: Promise.resolve({ orderNumber: '1001' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.updateOrderNotes).toHaveBeenCalledWith({
      orderId: 'order_1',
      internalNote: 'Internal note',
      customerNote: 'Customer update',
      sendCustomerEmail: true,
    })
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        emailDelivery: {
          attempted: true,
          sent: true,
        },
      },
    })
  })
})

