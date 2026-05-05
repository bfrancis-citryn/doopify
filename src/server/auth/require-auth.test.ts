import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAuthTokenFromCookieHeader: vi.fn(),
  getSessionUser: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAuthTokenFromCookieHeader: mocks.getAuthTokenFromCookieHeader,
  getSessionUser: mocks.getSessionUser,
}))

import { requireAdmin, requireAuth, requireOwner } from './require-auth'

const request = new Request('http://localhost/api/private', {
  headers: { cookie: 'doopify_token=session-token' },
})

describe('route auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.getAuthTokenFromCookieHeader.mockReturnValue(null)

    const auth = await requireAuth(request)

    expect(auth.ok).toBe(false)
    if (auth.ok) throw new Error('Expected unauthorized result')
    expect(auth.response.status).toBe(401)
  })

  it('blocks VIEWER from requireAdmin routes', async () => {
    mocks.getAuthTokenFromCookieHeader.mockReturnValue('session-token')
    mocks.getSessionUser.mockResolvedValue({
      id: 'viewer-1',
      email: 'viewer@example.com',
      firstName: null,
      lastName: null,
      role: 'VIEWER',
    })

    const auth = await requireAdmin(request)

    expect(auth.ok).toBe(false)
    if (auth.ok) throw new Error('Expected forbidden result')
    expect(auth.response.status).toBe(403)
    expect(await auth.response.json()).toEqual({
      success: false,
      error: 'Forbidden',
    })
  })

  it('allows STAFF through requireAdmin', async () => {
    mocks.getAuthTokenFromCookieHeader.mockReturnValue('session-token')
    mocks.getSessionUser.mockResolvedValue({
      id: 'staff-1',
      email: 'staff@example.com',
      firstName: null,
      lastName: null,
      role: 'STAFF',
    })

    const auth = await requireAdmin(request)

    expect(auth.ok).toBe(true)
    if (!auth.ok) throw new Error('Expected authorized result')
    expect(auth.user.role).toBe('STAFF')
  })

  it('allows OWNER through requireOwner', async () => {
    mocks.getAuthTokenFromCookieHeader.mockReturnValue('session-token')
    mocks.getSessionUser.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      firstName: null,
      lastName: null,
      role: 'OWNER',
    })

    const auth = await requireOwner(request)

    expect(auth.ok).toBe(true)
    if (!auth.ok) throw new Error('Expected authorized result')
    expect(auth.user.role).toBe('OWNER')
  })

  it('blocks STAFF from requireOwner routes', async () => {
    mocks.getAuthTokenFromCookieHeader.mockReturnValue('session-token')
    mocks.getSessionUser.mockResolvedValue({
      id: 'staff-2',
      email: 'staff2@example.com',
      firstName: null,
      lastName: null,
      role: 'STAFF',
    })

    const auth = await requireOwner(request)

    expect(auth.ok).toBe(false)
    if (auth.ok) throw new Error('Expected forbidden result')
    expect(auth.response.status).toBe(403)
  })

  it('allows ADMIN through requireAdmin', async () => {
    mocks.getAuthTokenFromCookieHeader.mockReturnValue('session-token')
    mocks.getSessionUser.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      firstName: null,
      lastName: null,
      role: 'ADMIN',
    })

    const auth = await requireAdmin(request)

    expect(auth.ok).toBe(true)
    if (!auth.ok) throw new Error('Expected authorized result')
    expect(auth.user.role).toBe('ADMIN')
  })

  it('blocks ADMIN from requireOwner routes', async () => {
    mocks.getAuthTokenFromCookieHeader.mockReturnValue('session-token')
    mocks.getSessionUser.mockResolvedValue({
      id: 'admin-2',
      email: 'admin2@example.com',
      firstName: null,
      lastName: null,
      role: 'ADMIN',
    })

    const auth = await requireOwner(request)

    expect(auth.ok).toBe(false)
    if (auth.ok) throw new Error('Expected forbidden result')
    expect(auth.response.status).toBe(403)
  })

  it('returns 401 when getSessionUser returns null (disabled user or expired session)', async () => {
    mocks.getAuthTokenFromCookieHeader.mockReturnValue('session-token')
    mocks.getSessionUser.mockResolvedValue(null)

    const auth = await requireAuth(request)

    expect(auth.ok).toBe(false)
    if (auth.ok) throw new Error('Expected unauthorized result')
    expect(auth.response.status).toBe(401)
  })

  it('does not expose token or session internals in blocked responses', async () => {
    mocks.getAuthTokenFromCookieHeader.mockReturnValue(null)

    const auth = await requireAuth(request)
    expect(auth.ok).toBe(false)
    if (auth.ok) throw new Error('Expected unauthorized result')

    const body = await auth.response.json()
    expect(body).toEqual({
      success: false,
      error: 'Unauthorized',
    })
    expect(JSON.stringify(body)).not.toContain('session-token')
    expect(JSON.stringify(body)).not.toContain('doopify_token')
  })
})
