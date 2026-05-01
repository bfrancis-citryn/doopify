import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  resolveOrderIdentifier: vi.fn(),
  getOrderAdjustmentSummary: vi.fn(),
  createReturnRecord: vi.fn(),
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
  createReturnRecord: mocks.createReturnRecord,
}))

import { GET } from './route'

describe('GET /api/orders/[orderNumber]/returns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads returns using internal order id identifier', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin_1', role: 'OWNER' } })
    mocks.resolveOrderIdentifier.mockResolvedValue({ orderId: 'order_1', orderNumber: 1001 })
    mocks.getOrderAdjustmentSummary.mockResolvedValue({
      returns: [{ id: 'ret_1', status: 'REQUESTED' }],
    })

    const response = await GET(new Request('http://localhost/api/orders/order_1/returns'), {
      params: Promise.resolve({ orderNumber: 'order_1' }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({
      success: true,
      data: [{ id: 'ret_1', status: 'REQUESTED' }],
    })
    expect(mocks.resolveOrderIdentifier).toHaveBeenCalledWith('order_1')
    expect(mocks.getOrderAdjustmentSummary).toHaveBeenCalledWith('order_1')
  })

  it('supports display order identifiers when resolver maps them', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, user: { id: 'admin_1', role: 'OWNER' } })
    mocks.resolveOrderIdentifier.mockResolvedValue({ orderId: 'order_converted_draft', orderNumber: 2042 })
    mocks.getOrderAdjustmentSummary.mockResolvedValue({ returns: [] })

    const response = await GET(new Request('http://localhost/api/orders/DPY0002042/returns'), {
      params: Promise.resolve({ orderNumber: 'DPY0002042' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.resolveOrderIdentifier).toHaveBeenCalledWith('DPY0002042')
    expect(mocks.getOrderAdjustmentSummary).toHaveBeenCalledWith('order_converted_draft')
  })
})