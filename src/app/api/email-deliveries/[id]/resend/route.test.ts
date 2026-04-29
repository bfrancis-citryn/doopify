import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resendEmailDelivery: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock('@/server/services/email-delivery.service', () => ({
  resendEmailDelivery: mocks.resendEmailDelivery,
}))
vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

import { POST } from './route'

describe('POST /api/email-deliveries/[id]/resend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff-1', email: 'staff@example.com', firstName: null, lastName: null, role: 'STAFF' },
    })
  })

  it('resends an eligible email delivery', async () => {
    mocks.resendEmailDelivery.mockResolvedValue({
      success: true,
      delivery: { id: 'email-2', status: 'SENT' },
    })

    const response = await POST(
      new Request('http://localhost/api/email-deliveries/email-1/resend', { method: 'POST' }),
      { params: Promise.resolve({ id: 'email-1' }) }
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      data: { id: 'email-2', status: 'SENT' },
    })
  })

  it('returns 404 when delivery is missing', async () => {
    mocks.resendEmailDelivery.mockResolvedValue({
      success: false,
      reason: 'NOT_FOUND',
      message: 'Email delivery not found',
    })

    const response = await POST(
      new Request('http://localhost/api/email-deliveries/missing/resend', { method: 'POST' }),
      { params: Promise.resolve({ id: 'missing' }) }
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Email delivery not found',
    })
  })

  it('returns 400 when delivery is not resendable', async () => {
    mocks.resendEmailDelivery.mockResolvedValue({
      success: false,
      reason: 'NOT_RESENDABLE',
      message: 'Only failed, bounced, or complained deliveries can be resent',
    })

    const response = await POST(
      new Request('http://localhost/api/email-deliveries/email-1/resend', { method: 'POST' }),
      { params: Promise.resolve({ id: 'email-1' }) }
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Only failed, bounced, or complained deliveries can be resent',
    })
  })
})
