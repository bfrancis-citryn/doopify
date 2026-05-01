import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  resolveOrderIdentifier: vi.fn(),
  getOrderAdjustmentSummary: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/services/order-identifier.service', async () => {
  const actual = await vi.importActual<typeof import('@/server/services/order-identifier.service')>(
    '@/server/services/order-identifier.service'
  )
  return {
    ...actual,
    resolveOrderIdentifier: mocks.resolveOrderIdentifier,
  }
})

vi.mock('@/server/services/order-adjustments.service', () => ({
  getOrderAdjustmentSummary: mocks.getOrderAdjustmentSummary,
}))

import { GET } from './route'
import { OrderIdentifierResolutionError } from '@/server/services/order-identifier.service'

describe('GET /api/orders/[orderNumber]/adjustments', () => {
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

    const response = await GET(new Request('http://localhost/api/orders/order_1/adjustments'), {
      params: Promise.resolve({ orderNumber: 'order_1' }),
    })

    expect(response.status).toBe(401)
    expect(mocks.resolveOrderIdentifier).not.toHaveBeenCalled()
  })

  it('loads adjustments using internal order id identifier', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin_1', role: 'OWNER' } })
    mocks.resolveOrderIdentifier.mockResolvedValue({ orderId: 'order_1', orderNumber: 1001 })
    mocks.getOrderAdjustmentSummary.mockResolvedValue({
      orderId: 'order_1',
      orderNumber: 1001,
      currency: 'USD',
      refunds: [],
      returns: [],
      paidAmountCents: 1200,
      recordedRefundAmountCents: 0,
      remainingRefundableAmountCents: 1200,
      orderItems: [],
    })

    const response = await GET(new Request('http://localhost/api/orders/order_1/adjustments'), {
      params: Promise.resolve({ orderNumber: 'order_1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.resolveOrderIdentifier).toHaveBeenCalledWith('order_1')
    expect(mocks.getOrderAdjustmentSummary).toHaveBeenCalledWith('order_1')
  })

  it('returns safe invalid identifier message', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin_1', role: 'OWNER' } })
    mocks.resolveOrderIdentifier.mockRejectedValue(
      new OrderIdentifierResolutionError('INVALID_IDENTIFIER', 'Invalid order identifier')
    )

    const response = await GET(new Request('http://localhost/api/orders/not-a-real-id/adjustments'), {
      params: Promise.resolve({ orderNumber: 'not-a-real-id' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid order identifier',
    })
  })
})