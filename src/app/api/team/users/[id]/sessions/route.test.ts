import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  getUserSessions: vi.fn(),
  revokeUserSessions: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({ requireOwner: mocks.requireOwner }))
vi.mock('@/server/services/team.service', () => ({
  getUserSessions: mocks.getUserSessions,
  revokeUserSessions: mocks.revokeUserSessions,
}))

import { DELETE, GET } from './route'

describe('team users [id] sessions route', () => {
  const ownerAuth = { ok: true, user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' } }
  const unauth = {
    ok: false,
    response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks non-owner from viewing sessions', async () => {
    mocks.requireOwner.mockResolvedValue(unauth)
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'u1' }) })
    expect(response.status).toBe(403)
    expect(mocks.getUserSessions).not.toHaveBeenCalled()
  })

  it('returns sessions for a user', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.getUserSessions.mockResolvedValue([
      { id: 's1', ip: '1.2.3.4', userAgent: 'Mozilla', createdAt: new Date(), expiresAt: new Date() },
    ])
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'u1' }) })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.sessions).toHaveLength(1)
    expect(payload.data.sessions[0].id).toBe('s1')
  })

  it('blocks non-owner from revoking sessions', async () => {
    mocks.requireOwner.mockResolvedValue(unauth)
    const response = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: 'u1' }) })
    expect(response.status).toBe(403)
    expect(mocks.revokeUserSessions).not.toHaveBeenCalled()
  })

  it('owner can revoke all sessions for a user', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.revokeUserSessions.mockResolvedValue({ count: 2 })
    const response = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: 'u1' }) })
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.revoked).toBe(2)
    expect(mocks.revokeUserSessions).toHaveBeenCalledWith('u1', ownerAuth.user)
  })
})
