import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  createTeamUser: vi.fn(),
  listTeamUsers: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({ requireOwner: mocks.requireOwner }))
vi.mock('@/server/services/team.service', () => ({
  createTeamUser: mocks.createTeamUser,
  listTeamUsers: mocks.listTeamUsers,
}))

import { GET, POST } from './route'

describe('team users route', () => {
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

  it('blocks non-owner from listing users', async () => {
    mocks.requireOwner.mockResolvedValue(unauth)
    const response = await GET(new Request('http://localhost/api/team/users'))
    expect(response.status).toBe(403)
    expect(mocks.listTeamUsers).not.toHaveBeenCalled()
  })

  it('returns user list for owner', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.listTeamUsers.mockResolvedValue([
      { id: 'u1', email: 'owner@example.com', role: 'OWNER', isActive: true },
    ])

    const response = await GET(new Request('http://localhost/api/team/users'))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.users).toHaveLength(1)
    expect(payload.data.users[0].role).toBe('OWNER')
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('passwordHash')
  })

  it('blocks non-owner from creating users', async () => {
    mocks.requireOwner.mockResolvedValue(unauth)
    const response = await POST(
      new Request('http://localhost/api/team/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@e.com', password: 'password123', role: 'STAFF' }),
      })
    )
    expect(response.status).toBe(403)
    expect(mocks.createTeamUser).not.toHaveBeenCalled()
  })

  it('owner can create a user with a role', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.createTeamUser.mockResolvedValue({
      id: 'new_u1',
      email: 'staff@example.com',
      firstName: null,
      lastName: null,
      role: 'STAFF',
      isActive: true,
      createdAt: new Date().toISOString(),
    })

    const response = await POST(
      new Request('http://localhost/api/team/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'staff@example.com', password: 'securepass1', role: 'STAFF' }),
      })
    )

    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.data.user.role).toBe('STAFF')

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('passwordHash')
    expect(serialized).not.toContain('securepass1')
  })
})
