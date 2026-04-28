import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmailDeliveryById: vi.fn(),
}))

vi.mock('@/server/services/email-delivery.service', () => ({
  getEmailDeliveryById: mocks.getEmailDeliveryById,
}))

import { GET } from './route'

describe('GET /api/email-deliveries/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an email delivery record', async () => {
    mocks.getEmailDeliveryById.mockResolvedValue({
      delivery: { id: 'email-1', status: 'FAILED' },
      resendPolicy: { canResend: true, blockers: [] },
      related: { order: { id: 'order-1', orderNumber: 1001 } },
    })

    const response = await GET(new Request('http://localhost/api/email-deliveries/email-1'), {
      params: Promise.resolve({ id: 'email-1' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      data: {
        delivery: { id: 'email-1', status: 'FAILED' },
        resendPolicy: { canResend: true, blockers: [] },
        related: { order: { id: 'order-1', orderNumber: 1001 } },
      },
    })
  })

  it('returns 404 when delivery is missing', async () => {
    mocks.getEmailDeliveryById.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost/api/email-deliveries/missing'), {
      params: Promise.resolve({ id: 'missing' }),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Email delivery not found',
    })
  })
})
