import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  requestPasswordReset: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({ requireOwner: mocks.requireOwner }))
vi.mock('@/server/services/team.service', () => ({
  requestPasswordReset: mocks.requestPasswordReset,
}))

import { POST } from './route'

describe('POST /api/team/users/[id]/reset-password', () => {
  const ownerAuth = { ok: true, user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' } }
  const unauth = {
    ok: false,
    response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks non-owner from generating reset links', async () => {
    mocks.requireOwner.mockResolvedValue(unauth)
    const response = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'u1' }) })
    expect(response.status).toBe(403)
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('owner generates reset token and token is returned in response', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.requestPasswordReset.mockResolvedValue({
      reset: { id: 'pr1', userId: 'u1', expiresAt: new Date(Date.now() + 86400000), createdAt: new Date() },
      rawToken: 'abc123rawresettoken',
    })

    const response = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'u1' }) })
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.data.resetToken).toBe('abc123rawresettoken')
    expect(payload.data.reset.userId).toBe('u1')

    // Token hash must NOT appear in response
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('tokenHash')
  })

  it('returns 400 when user not found or disabled', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.requestPasswordReset.mockRejectedValue(new Error('Cannot reset password for a disabled account.'))

    const response = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'disabled_u' }) })
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toContain('disabled')
  })
})
