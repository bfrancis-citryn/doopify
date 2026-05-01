import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  getStripeRuntimeConnection: vi.fn(),
  getStripeWebhookSecretSelection: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireOwner: mocks.requireOwner,
}))

vi.mock('@/server/payments/stripe-runtime.service', () => ({
  getStripeRuntimeConnection: mocks.getStripeRuntimeConnection,
  getStripeWebhookSecretSelection: mocks.getStripeWebhookSecretSelection,
}))

import { GET } from './route'

describe('GET /api/settings/payments/stripe/runtime-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires owner auth', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const response = await GET(new Request('http://localhost/api/settings/payments/stripe/runtime-status'))
    expect(response.status).toBe(403)
    expect(mocks.getStripeRuntimeConnection).not.toHaveBeenCalled()
  })

  it('returns safe runtime status without secret values', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.getStripeRuntimeConnection.mockResolvedValue({
      source: 'db',
      verified: true,
      mode: 'live',
      publishableKey: 'pk_live_visible',
      secretKey: 'sk_live_hidden',
      webhookSecret: 'whsec_hidden',
      accountId: 'acct_live_123',
      chargesEnabled: true,
      payoutsEnabled: true,
    })
    mocks.getStripeWebhookSecretSelection.mockResolvedValue({
      source: 'db',
      webhookSecret: 'whsec_hidden',
    })

    const response = await GET(new Request('http://localhost/api/settings/payments/stripe/runtime-status'))
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      data: {
        source: 'db',
        mode: 'live',
        hasPublishableKey: true,
        hasSecretKey: true,
        hasWebhookSecret: true,
        webhookSource: 'db',
        verified: true,
        accountId: 'acct_live_123',
        chargesEnabled: true,
        payoutsEnabled: true,
      },
    })

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('sk_live_hidden')
    expect(serialized).not.toContain('whsec_hidden')
  })
})