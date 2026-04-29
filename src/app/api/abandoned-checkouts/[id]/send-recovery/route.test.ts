import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  sendRecoveryEmailForCheckout: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/services/abandoned-checkout.service', () => ({
  sendRecoveryEmailForCheckout: mocks.sendRecoveryEmailForCheckout,
}))

import { POST } from './route'

describe('POST /api/abandoned-checkouts/[id]/send-recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires admin authorization', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await POST(
      new Request('http://localhost/api/abandoned-checkouts/checkout_1/send-recovery', { method: 'POST' }),
      { params: Promise.resolve({ id: 'checkout_1' }) }
    )

    expect(response.status).toBe(401)
    expect(mocks.sendRecoveryEmailForCheckout).not.toHaveBeenCalled()
  })

  it('sends manual recovery email for an admin', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', firstName: null, lastName: null, role: 'OWNER' },
    })
    mocks.sendRecoveryEmailForCheckout.mockResolvedValue({ sent: true })

    const response = await POST(
      new Request('http://localhost/api/abandoned-checkouts/checkout_1/send-recovery', { method: 'POST' }),
      { params: Promise.resolve({ id: 'checkout_1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.sendRecoveryEmailForCheckout).toHaveBeenCalledWith('checkout_1', { respectCadence: false })
  })
})
