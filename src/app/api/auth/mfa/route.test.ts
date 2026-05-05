import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  getOwnerMfaStatus: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireOwner: mocks.requireOwner,
}))

vi.mock('@/server/services/mfa.service', () => ({
  getOwnerMfaStatus: mocks.getOwnerMfaStatus,
}))

import { GET } from './route'

describe('GET /api/auth/mfa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks non-owners', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
    })

    const response = await GET(new Request('http://localhost/api/auth/mfa'))
    expect(response.status).toBe(403)
  })

  it('returns owner MFA status for owner sessions', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      user: { id: 'owner-1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.getOwnerMfaStatus.mockResolvedValue({
      enabled: true,
      pendingEnrollment: false,
      enabledAt: '2026-05-05T00:00:00.000Z',
      gracePeriodEndsAt: null,
      recoveryCodesRemaining: 7,
    })

    const response = await GET(new Request('http://localhost/api/auth/mfa'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        enabled: true,
        recoveryCodesRemaining: 7,
      },
    })
  })
})
