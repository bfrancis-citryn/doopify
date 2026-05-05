import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  verifyOwnerMfaLoginChallenge: vi.fn(),
  createSessionForUser: vi.fn(),
  setAuthCookie: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}))

vi.mock('@/server/services/mfa.service', () => ({
  verifyOwnerMfaLoginChallenge: mocks.verifyOwnerMfaLoginChallenge,
}))

vi.mock('@/server/services/auth.service', () => ({
  createSessionForUser: mocks.createSessionForUser,
}))

vi.mock('@/lib/auth', () => ({
  setAuthCookie: mocks.setAuthCookie,
}))

import { POST } from './route'

describe('POST /api/auth/mfa/challenge/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true })
  })

  it('verifies MFA challenge, creates session, and sets auth cookie', async () => {
    mocks.verifyOwnerMfaLoginChallenge.mockResolvedValue({
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        firstName: 'Owner',
        lastName: null,
        role: 'OWNER',
      },
      usedRecoveryCode: false,
      recoveryCodesRemaining: 5,
    })
    mocks.createSessionForUser.mockResolvedValue({
      token: 'session-token',
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        firstName: 'Owner',
        lastName: null,
        role: 'OWNER',
      },
    })

    const response = await POST(
      new Request('http://localhost/api/auth/mfa/challenge/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: 'challenge-1', code: '123456' }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.setAuthCookie).toHaveBeenCalledWith(expect.anything(), 'session-token')
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        usedRecoveryCode: false,
        recoveryCodesRemaining: 5,
      },
    })
  })

  it('rejects invalid challenge code', async () => {
    mocks.verifyOwnerMfaLoginChallenge.mockRejectedValue(new Error('Invalid MFA code'))

    const response = await POST(
      new Request('http://localhost/api/auth/mfa/challenge/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: 'challenge-1', code: 'bad-code' }),
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Invalid MFA code',
    })
  })
})
