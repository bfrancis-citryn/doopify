import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  changePassword: vi.fn(),
  getAuthTokenFromCookieHeader: vi.fn(),
  verifyToken: vi.fn(),
  recordAuditLogBestEffort: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/server/services/auth.service', () => ({ changePassword: mocks.changePassword }))
vi.mock('@/lib/auth', () => ({
  getAuthTokenFromCookieHeader: mocks.getAuthTokenFromCookieHeader,
  verifyToken: mocks.verifyToken,
}))
vi.mock('@/server/services/audit-log.service', () => ({
  recordAuditLogBestEffort: mocks.recordAuditLogBestEffort,
}))

import { PATCH } from './route'

describe('PATCH /api/auth/password', () => {
  const authUser = { id: 'u1', email: 'user@example.com', role: 'STAFF' }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ ok: true, user: authUser })
    mocks.changePassword.mockResolvedValue(undefined)
    mocks.getAuthTokenFromCookieHeader.mockReturnValue('session_token')
    mocks.verifyToken.mockResolvedValue({ sessionId: 's1', userId: 'u1' })
    mocks.recordAuditLogBestEffort.mockResolvedValue(null)
  })

  it('requires authentication', async () => {
    mocks.requireAuth.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
    })
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH' }))
    expect(response.status).toBe(401)
    expect(mocks.changePassword).not.toHaveBeenCalled()
  })

  it('returns 422 when passwords do not match', async () => {
    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'old', newPassword: 'newpass1234', confirmNewPassword: 'different' }),
      })
    )
    expect(response.status).toBe(422)
    expect(mocks.changePassword).not.toHaveBeenCalled()
  })

  it('changes password successfully', async () => {
    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'oldpass', newPassword: 'newpass1234', confirmNewPassword: 'newpass1234' }),
      })
    )
    expect(response.status).toBe(200)
    expect(mocks.changePassword).toHaveBeenCalledWith('u1', 'oldpass', 'newpass1234', 'session_token')
    const payload = await response.json()
    expect(payload.data.changed).toBe(true)

    // Ensure passwords not in response
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('oldpass')
    expect(serialized).not.toContain('newpass1234')
  })

  it('returns 400 when current password is wrong', async () => {
    mocks.changePassword.mockRejectedValue(new Error('Current password is incorrect.'))
    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'newpass1234', confirmNewPassword: 'newpass1234' }),
      })
    )
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toContain('Current password')
  })

  it('returns 422 when new password same as current', async () => {
    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'samepass1', newPassword: 'samepass1', confirmNewPassword: 'samepass1' }),
      })
    )
    expect(response.status).toBe(422)
    const payload = await response.json()
    expect(payload.error).toContain('differ')
  })
})
