import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  parseSupportedProvider: vi.fn(),
  saveProviderCredentials: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireOwner: mocks.requireOwner,
}))

vi.mock('@/server/services/provider-connection.service', () => ({
  parseSupportedProvider: mocks.parseSupportedProvider,
  saveProviderCredentials: mocks.saveProviderCredentials,
}))

import { POST } from './route'

describe('settings providers credentials route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.parseSupportedProvider.mockReturnValue('RESEND')
  })

  it('requires owner auth', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/settings/providers/resend/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 're_test_secret' }),
      }),
      { params: Promise.resolve({ provider: 'resend' }) }
    )

    expect(response.status).toBe(401)
    expect(mocks.saveProviderCredentials).not.toHaveBeenCalled()
  })

  it('saves credentials and returns masked status metadata only', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.saveProviderCredentials.mockResolvedValue({
      provider: 'RESEND',
      state: 'CREDENTIALS_SAVED',
      credentialMeta: [{ key: 'API_KEY', present: true, maskedValue: 're_t••••et' }],
    })

    const response = await POST(
      new Request('http://localhost/api/settings/providers/resend/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 're_test_secret' }),
      }),
      { params: Promise.resolve({ provider: 'resend' }) }
    )

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(mocks.saveProviderCredentials).toHaveBeenCalledWith('RESEND', {
      apiKey: 're_test_secret',
    })
    expect(payload).toMatchObject({
      success: true,
      data: {
        provider: 'RESEND',
        status: {
          state: 'CREDENTIALS_SAVED',
        },
      },
    })
    expect(JSON.stringify(payload)).not.toContain('re_test_secret')
  })
})

