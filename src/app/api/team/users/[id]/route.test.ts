import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  deleteDisabledTeamUser: vi.fn(),
  disableTeamUser: vi.fn(),
  reactivateTeamUser: vi.fn(),
  updateTeamUserProfile: vi.fn(),
  updateTeamUserRole: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({ requireOwner: mocks.requireOwner }))
vi.mock('@/server/services/team.service', () => ({
  deleteDisabledTeamUser: mocks.deleteDisabledTeamUser,
  disableTeamUser: mocks.disableTeamUser,
  reactivateTeamUser: mocks.reactivateTeamUser,
  updateTeamUserProfile: mocks.updateTeamUserProfile,
  updateTeamUserRole: mocks.updateTeamUserRole,
}))

import { DELETE, PATCH } from './route'

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

  it('blocks non-owner from update_profile mutations', async () => {
    mocks.requireOwner.mockResolvedValue(unauth)
    const response = await PATCH(
      new Request('http://localhost/api/team/users/u1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_profile', firstName: 'Ada', lastName: 'Lovelace' }),
      }),
      { params: Promise.resolve({ id: 'u1' }) }
    )
    expect(response.status).toBe(403)
    expect(mocks.updateTeamUserProfile).not.toHaveBeenCalled()
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

  it('owner can update a team member profile names', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.updateTeamUserProfile.mockResolvedValue({
      id: 'u1',
      email: 'staff@e.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'STAFF',
      isActive: true,
    })

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_profile', firstName: 'Ada', lastName: 'Lovelace' }),
      }),
      { params: Promise.resolve({ id: 'u1' }) }
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(JSON.stringify(payload)).not.toContain('passwordHash')
    expect(JSON.stringify(payload)).not.toContain('mfaTotpSecretEnc')
    expect(JSON.stringify(payload)).not.toContain('tokenHash')
    expect(JSON.stringify(payload)).not.toContain('sessionToken')
    expect(mocks.updateTeamUserProfile).toHaveBeenCalledWith(
      'u1',
      { firstName: 'Ada', lastName: 'Lovelace' },
      ownerAuth.user
    )
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

  it('blocks non-owner from deleting users', async () => {
    mocks.requireOwner.mockResolvedValue(unauth)
    const response = await DELETE(new Request('http://localhost/api/team/users/u1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'u1' }),
    })
    expect(response.status).toBe(403)
    expect(mocks.deleteDisabledTeamUser).not.toHaveBeenCalled()
  })

  it('owner can delete a disabled user', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.deleteDisabledTeamUser.mockResolvedValue({
      id: 'u1',
      email: 'staff@e.com',
      deleted: true,
      cleanup: { sessionsDeleted: 1, passwordResetsDeleted: 1, mfaChallengesDeleted: 0 },
    })

    const response = await DELETE(new Request('http://localhost/api/team/users/u1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'u1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.deleteDisabledTeamUser).toHaveBeenCalledWith('u1', ownerAuth.user)
  })

  it('returns 400 when owner attempts to delete an active user', async () => {
    mocks.requireOwner.mockResolvedValue(ownerAuth)
    mocks.deleteDisabledTeamUser.mockRejectedValue(new Error('Only disabled users can be deleted.'))

    const response = await DELETE(new Request('http://localhost/api/team/users/u1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'u1' }),
    })

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toContain('Only disabled users')
  })
})
