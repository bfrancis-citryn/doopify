import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  verifyToken: mocks.verifyToken,
}))

import { proxy } from './proxy'

describe('proxy auth protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps storefront API routes public', async () => {
    const response = await proxy(new NextRequest('http://localhost/api/storefront/collections'))

    expect(response.status).toBe(200)
    expect(mocks.verifyToken).not.toHaveBeenCalled()
  })

  it('blocks private admin API routes when no auth cookie exists', async () => {
    const response = await proxy(new NextRequest('http://localhost/api/collections'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Unauthorized',
    })
    expect(mocks.verifyToken).not.toHaveBeenCalled()
  })

  it('returns 401 when a private admin API token is invalid', async () => {
    mocks.verifyToken.mockResolvedValue(null)

    const response = await proxy(
      new NextRequest('http://localhost/api/collections', {
        headers: {
          cookie: 'doopify_token=bad_token',
        },
      })
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid or expired session',
    })
    expect(mocks.verifyToken).toHaveBeenCalledWith('bad_token')
  })

  it('allows private admin API routes when auth is valid and injects identity headers', async () => {
    mocks.verifyToken.mockResolvedValue({
      userId: 'user_1',
      email: 'admin@example.com',
      role: 'OWNER',
      sessionId: 'session_1',
    })

    const response = await proxy(
      new NextRequest('http://localhost/api/collections', {
        headers: {
          cookie: 'doopify_token=good_token',
        },
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-user-id')).toBe('user_1')
    expect(response.headers.get('x-user-role')).toBe('OWNER')
    expect(response.headers.get('x-user-email')).toBe('admin@example.com')
  })
})
