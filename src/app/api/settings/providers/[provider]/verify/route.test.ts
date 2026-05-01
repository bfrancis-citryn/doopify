import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  parseSupportedProvider: vi.fn(),
  verifyProviderConnection: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireOwner: mocks.requireOwner,
}))

vi.mock('@/server/services/provider-connection.service', () => ({
  parseSupportedProvider: mocks.parseSupportedProvider,
  verifyProviderConnection: mocks.verifyProviderConnection,
}))

import { POST } from './route'

describe('settings providers verify route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.parseSupportedProvider.mockReturnValue('STRIPE')
  })

  it('returns 401 json for unauthenticated users', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ provider: 'stripe' }),
    })

    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(mocks.verifyProviderConnection).not.toHaveBeenCalled()
  })

  it('returns 403 json for non-owner users', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ provider: 'stripe' }),
    })

    expect(response.status).toBe(403)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(mocks.verifyProviderConnection).not.toHaveBeenCalled()
  })

  it('returns 404 for unsupported provider', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.parseSupportedProvider.mockReturnValue(null)

    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ provider: 'unknown-provider' }),
    })

    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload).toMatchObject({ success: false, error: 'Unsupported provider' })
    expect(mocks.verifyProviderConnection).not.toHaveBeenCalled()
  })

  it('returns 200 success payload with verification.ok false on failed verification', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })

    mocks.verifyProviderConnection.mockResolvedValue({
      status: { provider: 'STRIPE', state: 'ERROR', lastError: 'invalid api key' },
      verification: { ok: false, message: 'invalid api key' },
    })

    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ provider: 'stripe' }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      data: {
        provider: 'STRIPE',
        status: {
          state: 'ERROR',
          lastError: 'invalid api key',
        },
        verification: {
          ok: false,
          message: 'invalid api key',
        },
      },
    })
    expect(JSON.stringify(payload)).not.toContain('sk_test_')
  })
})

