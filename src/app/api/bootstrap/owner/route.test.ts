import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  activeOwnerExists: vi.fn(),
  bootstrapOwner: vi.fn(),
  loginUser: vi.fn(),
  setAuthCookie: vi.fn(),
}))

vi.mock('@/server/services/team.service', () => ({
  activeOwnerExists: mocks.activeOwnerExists,
  bootstrapOwner: mocks.bootstrapOwner,
}))

vi.mock('@/server/services/auth.service', () => ({
  loginUser: mocks.loginUser,
}))

vi.mock('@/lib/auth', () => ({
  setAuthCookie: mocks.setAuthCookie,
}))

import { GET, POST } from './route'

describe('bootstrap owner route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.setAuthCookie.mockReturnValue(undefined)
  })

  describe('GET /api/bootstrap/owner', () => {
    it('returns bootstrapAvailable true when no owner exists', async () => {
      mocks.activeOwnerExists.mockResolvedValue(false)

      const response = await GET()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.data.bootstrapAvailable).toBe(true)
    })

    it('returns bootstrapAvailable false when owner already exists', async () => {
      mocks.activeOwnerExists.mockResolvedValue(true)

      const response = await GET()
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.data.bootstrapAvailable).toBe(false)
    })
  })

  describe('POST /api/bootstrap/owner', () => {
    const validBody = {
      email: 'owner@example.com',
      password: 'securepassword1',
      confirmPassword: 'securepassword1',
      firstName: 'Ada',
    }

    it('returns 409 when owner already exists', async () => {
      mocks.activeOwnerExists.mockResolvedValue(true)

      const response = await POST(
        new Request('http://localhost/api/bootstrap/owner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validBody),
        })
      )

      expect(response.status).toBe(409)
      expect(mocks.bootstrapOwner).not.toHaveBeenCalled()
    })

    it('returns 422 when passwords do not match', async () => {
      mocks.activeOwnerExists.mockResolvedValue(false)

      const response = await POST(
        new Request('http://localhost/api/bootstrap/owner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...validBody, confirmPassword: 'different' }),
        })
      )

      expect(response.status).toBe(422)
      expect(mocks.bootstrapOwner).not.toHaveBeenCalled()
    })

    it('creates owner, signs in, and sets auth cookie on success', async () => {
      mocks.activeOwnerExists.mockResolvedValue(false)
      mocks.bootstrapOwner.mockResolvedValue({ id: 'u1', email: 'owner@example.com', role: 'OWNER' })
      mocks.loginUser.mockResolvedValue({
        token: 'jwt_token',
        user: { id: 'u1', email: 'owner@example.com', role: 'OWNER' },
      })

      const response = await POST(
        new Request('http://localhost/api/bootstrap/owner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validBody),
        })
      )

      expect(response.status).toBe(200)
      expect(mocks.bootstrapOwner).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'owner@example.com', password: 'securepassword1' })
      )
      expect(mocks.loginUser).toHaveBeenCalledWith('owner@example.com', 'securepassword1')
      expect(mocks.setAuthCookie).toHaveBeenCalledWith(expect.anything(), 'jwt_token')

      const payload = await response.json()
      const serialized = JSON.stringify(payload)
      expect(serialized).not.toContain('securepassword1')
    })

    it('returns 400 when bootstrapOwner throws', async () => {
      mocks.activeOwnerExists.mockResolvedValue(false)
      mocks.bootstrapOwner.mockRejectedValue(new Error('Invalid setup token.'))

      const response = await POST(
        new Request('http://localhost/api/bootstrap/owner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validBody),
        })
      )

      expect(response.status).toBe(400)
      const payload = await response.json()
      expect(payload.error).toBe('Invalid setup token.')
    })
  })
})
