import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  setAuthCookie: vi.fn(),
  authenticateUserCredentials: vi.fn(),
  createSessionForUser: vi.fn(),
  ensureOwnerMfaGracePeriod: vi.fn(),
  shouldChallengeOwnerOnLogin: vi.fn(),
  beginOwnerMfaLoginChallenge: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}))

vi.mock('@/lib/auth', () => ({
  setAuthCookie: mocks.setAuthCookie,
}))

vi.mock('@/server/services/auth.service', () => ({
  authenticateUserCredentials: mocks.authenticateUserCredentials,
  createSessionForUser: mocks.createSessionForUser,
}))

vi.mock('@/server/services/mfa.service', () => ({
  ensureOwnerMfaGracePeriod: mocks.ensureOwnerMfaGracePeriod,
  shouldChallengeOwnerOnLogin: mocks.shouldChallengeOwnerOnLogin,
  beginOwnerMfaLoginChallenge: mocks.beginOwnerMfaLoginChallenge,
}))

import { POST } from './route'

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true })
  })

  it('returns an MFA challenge for owner accounts with MFA enabled', async () => {
    mocks.authenticateUserCredentials.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      firstName: null,
      lastName: null,
      role: 'OWNER',
      mfaTotpSecretEnc: 'enc:secret',
      mfaEnabledAt: new Date(),
    })
    mocks.shouldChallengeOwnerOnLogin.mockReturnValue(true)
    mocks.beginOwnerMfaLoginChallenge.mockResolvedValue({
      challengeId: 'challenge-1',
      expiresAt: new Date('2026-05-05T18:00:00.000Z'),
    })

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@example.com', password: 'secret' }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        mfaRequired: true,
        challengeId: 'challenge-1',
      },
    })
    expect(mocks.createSessionForUser).not.toHaveBeenCalled()
    expect(mocks.setAuthCookie).not.toHaveBeenCalled()
  })

  it('creates a session and sets auth cookie when MFA challenge is not required', async () => {
    mocks.authenticateUserCredentials.mockResolvedValue({
      id: 'staff-1',
      email: 'staff@example.com',
      firstName: 'Sam',
      lastName: null,
      role: 'STAFF',
      mfaTotpSecretEnc: null,
      mfaEnabledAt: null,
    })
    mocks.shouldChallengeOwnerOnLogin.mockReturnValue(false)
    mocks.createSessionForUser.mockResolvedValue({
      token: 'session-token',
      user: {
        id: 'staff-1',
        email: 'staff@example.com',
        firstName: 'Sam',
        lastName: null,
        role: 'STAFF',
      },
    })

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'staff@example.com', password: 'secret' }),
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.createSessionForUser).toHaveBeenCalled()
    expect(mocks.setAuthCookie).toHaveBeenCalledWith(expect.anything(), 'session-token')
  })
})
