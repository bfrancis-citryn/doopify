import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  listProviderStatuses: vi.fn(),
  getStripeProviderStatusSnapshot: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireOwner: mocks.requireOwner,
}))

vi.mock('@/server/services/provider-connection.service', () => ({
  getStripeProviderStatusSnapshot: mocks.getStripeProviderStatusSnapshot,
  listProviderStatuses: mocks.listProviderStatuses,
}))

import { GET } from './route'

describe('settings providers route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET requires owner auth', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const response = await GET(new Request('http://localhost/api/settings/providers'))
    expect(response.status).toBe(403)
    expect(mocks.listProviderStatuses).not.toHaveBeenCalled()
  })

  it('returns provider status payload without secret values', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })

    mocks.listProviderStatuses.mockResolvedValue([
      {
        provider: 'RESEND',
        state: 'VERIFIED',
        source: 'db',
        credentialMeta: [{ key: 'API_KEY', present: true, maskedValue: 're_1••••yz' }],
      },
    ])
    mocks.getStripeProviderStatusSnapshot.mockResolvedValue({
      configured: false,
      verified: false,
      mode: null,
      publishableKeyMasked: null,
      secretKeyMasked: null,
      webhookSecretMasked: null,
      hasPublishableKey: false,
      hasSecretKey: false,
      hasWebhookSecret: false,
      webhookConfigured: false,
      accountId: null,
      chargesEnabled: null,
      payoutsEnabled: null,
      lastVerifiedAt: null,
      lastError: null,
      source: 'none',
      runtimeSource: 'none',
    })

    const response = await GET(new Request('http://localhost/api/settings/providers'))
    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload).toMatchObject({
      success: true,
      data: {
        providers: [
          {
            provider: 'RESEND',
            state: 'VERIFIED',
          },
        ],
      },
    })
    expect(JSON.stringify(payload)).not.toContain('re_test_secret')
  })
})

