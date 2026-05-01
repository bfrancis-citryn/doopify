import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  resolveOrderIdentifier: vi.fn(),
  getOrderRefunds: vi.fn(),
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

vi.mock('@/server/services/refund.service', () => ({
  getOrderRefunds: mocks.getOrderRefunds,
  issueRefund: vi.fn(),
}))

import { GET } from './route'
import { OrderIdentifierResolutionError } from '@/server/services/order-identifier.service'

describe('GET /api/orders/[orderNumber]/refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads refunds using internal order id identifier', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin_1', role: 'OWNER' } })
    mocks.resolveOrderIdentifier.mockResolvedValue({ orderId: 'order_1', orderNumber: 1001 })
    mocks.getOrderRefunds.mockResolvedValue([
      { id: 'refund_1', amountCents: 500, status: 'ISSUED' },
    ])

    const response = await GET(new Request('http://localhost/api/orders/order_1/refunds'), {
      params: Promise.resolve({ orderNumber: 'order_1' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      data: [{ id: 'refund_1', amountCents: 500, status: 'ISSUED' }],
    })
    expect(mocks.resolveOrderIdentifier).toHaveBeenCalledWith('order_1')
    expect(mocks.getOrderRefunds).toHaveBeenCalledWith('order_1')
  })

  it('returns safe invalid identifier message', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin_1', role: 'OWNER' } })
    mocks.resolveOrderIdentifier.mockRejectedValue(
      new OrderIdentifierResolutionError('INVALID_IDENTIFIER', 'Invalid order identifier')
    )

    const response = await GET(new Request('http://localhost/api/orders/not-a-real-id/refunds'), {
      params: Promise.resolve({ orderNumber: 'not-a-real-id' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid order identifier',
    })
  })
})
