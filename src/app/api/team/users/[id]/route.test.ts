import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  disableTeamUser: vi.fn(),
  reactivateTeamUser: vi.fn(),
  updateTeamUserRole: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({ requireOwner: mocks.requireOwner }))
vi.mock('@/server/services/team.service', () => ({
  disableTeamUser: mocks.disableTeamUser,
  reactivateTeamUser: mocks.reactivateTeamUser,
  updateTeamUserRole: mocks.updateTeamUserRole,
}))

import { PATCH } from './route'

describe('team users [id] route', () => {
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

  it('blocks non-owner from patching users', async () => {
    mocks.requireOwner.mockResolvedValue(unauth)
    const response = await PATCH(
      new Request('http://localhost/api/team/users/u1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      }),
      { params: Promise.resolve({ id: 'u1' }) }
    )
    expect(response.status).toBe(403)
    expect(mocks.disableTeamUser).not.toHaveBeenCalled()
  })

  it('owner can disable a user', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.disableTeamUser.mockResolvedValue({ id: 'u1', email: 'staff@e.com', role: 'STAFF', isActive: false })

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      }),
      { params: Promise.resolve({ id: 'u1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.disableTeamUser).toHaveBeenCalledWith('u1', ownerAuth.user)
  })

  it('owner can reactivate a user', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.reactivateTeamUser.mockResolvedValue({ id: 'u1', email: 'staff@e.com', role: 'STAFF', isActive: true })

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' }),
      }),
      { params: Promise.resolve({ id: 'u1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.reactivateTeamUser).toHaveBeenCalledWith('u1', ownerAuth.user)
  })

  it('owner can change a user role', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.updateTeamUserRole.mockResolvedValue({ id: 'u1', email: 'staff@e.com', role: 'ADMIN', isActive: true })

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_role', role: 'ADMIN' }),
      }),
      { params: Promise.resolve({ id: 'u1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.updateTeamUserRole).toHaveBeenCalledWith('u1', 'ADMIN', ownerAuth.user)
  })

  it('returns 400 with last-owner error when trying to disable last owner', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.disableTeamUser.mockRejectedValue(
      new Error('Cannot disable this user: this is the only active OWNER account.')
    )

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      }),
      { params: Promise.resolve({ id: 'owner_1' }) }
    )

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toContain('only active OWNER')
  })
})
