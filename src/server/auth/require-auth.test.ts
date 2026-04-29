import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@prisma/client'

import { requireAdmin, requireAuth, requireOwner, requireRole } from './require-auth'

vi.mock('@/lib/auth', () => ({
  getAuthTokenFromCookieHeader: vi.fn((cookieHeader: string | null) => {
    if (!cookieHeader) return null
    const match = /doopify_token=([^;]+)/.exec(cookieHeader)
    return match?.[1] ?? null
  }),
  getSessionUser: vi.fn(),
}))

const { getSessionUser } = await import('@/lib/auth')

function makeRequest(token?: string) {
  return new Request('https://doopify.test/api/protected', {
    headers: token ? { cookie: `doopify_token=${token}` } : {},
  })
}

function mockUser(role: UserRole) {
  vi.mocked(getSessionUser).mockResolvedValue({
    id: 'user_1',
    email: 'admin@example.com',
    firstName: 'Ada',
    lastName: 'Admin',
    role,
    isActive: true,
  })
}

describe('route-level auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no auth cookie is present', async () => {
    const auth = await requireAuth(makeRequest())

    expect(auth.ok).toBe(false)
    if (!auth.ok) {
      expect(auth.response.status).toBe(401)
      await expect(auth.response.json()).resolves.toEqual({ success: false, error: 'Unauthorized' })
    }
  })

  it('returns 401 when the session cannot be verified', async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)

    const auth = await requireAuth(makeRequest('bad-token'))

    expect(auth.ok).toBe(false)
    if (!auth.ok) {
      expect(auth.response.status).toBe(401)
      await expect(auth.response.json()).resolves.toEqual({ success: false, error: 'Invalid or expired session' })
    }
  })

  it('allows any active logged-in user through requireAuth', async () => {
    mockUser('VIEWER')

    const auth = await requireAuth(makeRequest('viewer-token'))

    expect(auth.ok).toBe(true)
    if (auth.ok) {
      expect(auth.user).toMatchObject({
        id: 'user_1',
        email: 'admin@example.com',
        role: 'VIEWER',
      })
    }
  })

  it('allows OWNER and STAFF through requireAdmin', async () => {
    mockUser('OWNER')
    await expect(requireAdmin(makeRequest('owner-token'))).resolves.toMatchObject({ ok: true })

    mockUser('STAFF')
    await expect(requireAdmin(makeRequest('staff-token'))).resolves.toMatchObject({ ok: true })
  })

  it('blocks VIEWER from requireAdmin with 403', async () => {
    mockUser('VIEWER')

    const auth = await requireAdmin(makeRequest('viewer-token'))

    expect(auth.ok).toBe(false)
    if (!auth.ok) {
      expect(auth.response.status).toBe(403)
      await expect(auth.response.json()).resolves.toEqual({ success: false, error: 'Forbidden' })
    }
  })

  it('allows only OWNER through requireOwner', async () => {
    mockUser('OWNER')
    await expect(requireOwner(makeRequest('owner-token'))).resolves.toMatchObject({ ok: true })

    mockUser('STAFF')
    const auth = await requireOwner(makeRequest('staff-token'))
    expect(auth.ok).toBe(false)
    if (!auth.ok) expect(auth.response.status).toBe(403)
  })

  it('supports custom role lists with requireRole', async () => {
    mockUser('VIEWER')

    await expect(requireRole(makeRequest('viewer-token'), ['VIEWER'])).resolves.toMatchObject({ ok: true })

    const auth = await requireRole(makeRequest('viewer-token'), ['OWNER'])
    expect(auth.ok).toBe(false)
    if (!auth.ok) expect(auth.response.status).toBe(403)
  })
})
