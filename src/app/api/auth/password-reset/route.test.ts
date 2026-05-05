import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  acceptPasswordReset: vi.fn(),
}))

vi.mock('@/server/services/team.service', () => ({
  acceptPasswordReset: mocks.acceptPasswordReset,
}))

import { POST } from './route'

describe('POST /api/auth/password-reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.acceptPasswordReset.mockResolvedValue(undefined)
  })

  it('resets password with valid token', async () => {
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid_raw_token', newPassword: 'newpass1234', confirmNewPassword: 'newpass1234' }),
      })
    )
    expect(response.status).toBe(200)
    expect(mocks.acceptPasswordReset).toHaveBeenCalledWith('valid_raw_token', 'newpass1234')
    const payload = await response.json()
    expect(payload.data.reset).toBe(true)
  })

  it('returns 422 when passwords do not match', async () => {
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'tok', newPassword: 'pass1234', confirmNewPassword: 'different' }),
      })
    )
    expect(response.status).toBe(422)
    expect(mocks.acceptPasswordReset).not.toHaveBeenCalled()
  })

  it('returns 400 when token is invalid or expired', async () => {
    mocks.acceptPasswordReset.mockRejectedValue(new Error('Invalid or expired reset link.'))
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'bad_token', newPassword: 'pass1234', confirmNewPassword: 'pass1234' }),
      })
    )
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toContain('expired')
  })
})
