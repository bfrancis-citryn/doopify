import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  parseSupportedProvider: vi.fn(),
  getProviderStatus: vi.fn(),
  disconnectProvider: vi.fn(),
  auditActorFromUser: vi.fn(),
  recordAuditLogBestEffort: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireOwner: mocks.requireOwner,
}))

vi.mock('@/server/services/provider-connection.service', () => ({
  parseSupportedProvider: mocks.parseSupportedProvider,
  getProviderStatus: mocks.getProviderStatus,
  disconnectProvider: mocks.disconnectProvider,
}))

vi.mock('@/server/services/audit-log.service', () => ({
  auditActorFromUser: mocks.auditActorFromUser,
  recordAuditLogBestEffort: mocks.recordAuditLogBestEffort,
}))

import { GET } from './route'

describe('settings providers [provider] route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.parseSupportedProvider.mockReturnValue('STRIPE')
  })

  it('requires owner auth', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const response = await GET(new Request('http://localhost/api/settings/providers/stripe'), {
      params: Promise.resolve({ provider: 'stripe' }),
    })

    expect(response.status).toBe(403)
    expect(mocks.getProviderStatus).not.toHaveBeenCalled()
  })

  it('returns verified status/metadata without exposing raw Stripe secrets after reload', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })

    mocks.getProviderStatus.mockResolvedValue({
      provider: 'STRIPE',
      category: 'PAYMENT',
      integrationType: 'PAYMENT_STRIPE',
      state: 'VERIFIED',
      source: 'db',
      hasCredentials: true,
      verifiedAt: '2026-05-06T10:00:00.000Z',
      lastVerifiedAt: '2026-05-06T10:00:00.000Z',
      lastError: null,
      verificationData: {
        accountId: 'acct_verified_reload',
        chargesEnabled: true,
        payoutsEnabled: true,
      },
      updatedAt: '2026-05-06T10:00:00.000Z',
      credentialMeta: [
        { key: 'PUBLISHABLE_KEY', present: true, maskedValue: 'pk_test_••••••1234' },
        { key: 'SECRET_KEY', present: true, maskedValue: 'sk_test_••••••5678' },
        { key: 'WEBHOOK_SECRET', present: true, maskedValue: 'whsec_••••••9012' },
        { key: 'MODE', present: true, maskedValue: 'test' },
      ],
    })

    const response = await GET(new Request('http://localhost/api/settings/providers/stripe'), {
      params: Promise.resolve({ provider: 'stripe' }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      success: true,
      data: {
        provider: 'STRIPE',
        status: {
          state: 'VERIFIED',
          source: 'db',
          hasCredentials: true,
          lastVerifiedAt: '2026-05-06T10:00:00.000Z',
        },
      },
    })

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('sk_test_raw')
    expect(serialized).not.toContain('whsec_raw')
  })
})

