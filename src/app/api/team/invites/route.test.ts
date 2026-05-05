import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  inviteTeamUser: vi.fn(),
  listPendingInvites: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({ requireOwner: mocks.requireOwner }))
vi.mock('@/server/services/team.service', () => ({
  inviteTeamUser: mocks.inviteTeamUser,
  listPendingInvites: mocks.listPendingInvites,
}))

import { GET, POST } from './route'

describe('team invites route', () => {
  const ownerAuth = {
    ok: true,
    user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
  }
  const unauth = {
    ok: false,
    response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks non-owner from listing invites', async () => {
    mocks.requireOwner.mockResolvedValue(unauth)
    const response = await GET(new Request('http://localhost/api/team/invites'))
    expect(response.status).toBe(403)
    expect(mocks.listPendingInvites).not.toHaveBeenCalled()
  })

  it('owner can list pending invites without seeing raw tokens', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.listPendingInvites.mockResolvedValue([
      { id: 'inv_1', email: 'pending@e.com', role: 'STAFF', expiresAt: new Date(), createdAt: new Date(), invitedById: 'owner_1' },
    ])

    const response = await GET(new Request('http://localhost/api/team/invites'))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.invites).toHaveLength(1)
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('tokenHash')
  })

  it('blocks non-owner from creating invites', async () => {
    mocks.requireOwner.mockResolvedValue(unauth)
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@e.com', role: 'STAFF' }),
      })
    )
    expect(response.status).toBe(403)
    expect(mocks.inviteTeamUser).not.toHaveBeenCalled()
  })

  it('owner can invite a team member and receives raw token for sharing', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.inviteTeamUser.mockResolvedValue({
      invite: { id: 'inv_1', email: 'new@example.com', role: 'ADMIN', expiresAt: new Date(), createdAt: new Date(), invitedById: 'owner_1' },
      rawToken: 'abc123rawtoken',
    })

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com', role: 'ADMIN' }),
      })
    )

    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.data.inviteToken).toBe('abc123rawtoken')
    expect(payload.data.invite.email).toBe('new@example.com')

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('tokenHash')
  })
})
