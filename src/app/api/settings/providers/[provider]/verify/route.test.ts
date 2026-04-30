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
    expect(mocks.verifyProviderConnection).not.toHaveBeenCalled()
  })

  it('surfaces verification failure as safe json error', async () => {
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

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload).toMatchObject({ success: false, error: 'invalid api key' })
  })
})

