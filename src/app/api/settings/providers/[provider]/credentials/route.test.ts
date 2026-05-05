import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  auditActorFromUser: vi.fn(),
  recordAuditLogBestEffort: vi.fn(),
  parseSupportedProvider: vi.fn(),
  saveProviderCredentials: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireOwner: mocks.requireOwner,
}))

vi.mock('@/server/services/audit-log.service', () => ({
  auditActorFromUser: mocks.auditActorFromUser,
  recordAuditLogBestEffort: mocks.recordAuditLogBestEffort,
}))

vi.mock('@/server/services/provider-connection.service', () => ({
  parseSupportedProvider: mocks.parseSupportedProvider,
  saveProviderCredentials: mocks.saveProviderCredentials,
}))

import { POST } from './route'

describe('settings providers credentials route', () => {
  const actor = {
    actorType: 'STAFF',
    actorId: 'owner_1',
    actorEmail: 'owner@example.com',
    actorRole: 'OWNER',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.parseSupportedProvider.mockReturnValue('RESEND')
    mocks.auditActorFromUser.mockReturnValue(actor)
    mocks.recordAuditLogBestEffort.mockResolvedValue({ id: 'audit_1' })
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
        body: JSON.stringify({ apiKey: 'sample-provider-key' }),
      }),
      { params: Promise.resolve({ provider: 'resend' }) }
    )

    expect(response.status).toBe(401)
    expect(mocks.saveProviderCredentials).not.toHaveBeenCalled()
    expect(mocks.recordAuditLogBestEffort).not.toHaveBeenCalled()
  })

  it('saves credentials, returns masked status metadata only, and audits without raw values', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.saveProviderCredentials.mockResolvedValue({
      provider: 'RESEND',
      category: 'EMAIL',
      integrationType: 'EMAIL_RESEND',
      state: 'CREDENTIALS_SAVED',
      source: 'db',
      hasCredentials: true,
      credentialMeta: [{ key: 'API_KEY', present: true, maskedValue: 'samp••••ey' }],
    })

    const response = await POST(
      new Request('http://localhost/api/settings/providers/resend/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sample-provider-key', fromEmail: 'store@example.com' }),
      }),
      { params: Promise.resolve({ provider: 'resend' }) }
    )

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(mocks.saveProviderCredentials).toHaveBeenCalledWith('RESEND', {
      apiKey: 'sample-provider-key',
      fromEmail: 'store@example.com',
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
    expect(JSON.stringify(payload)).not.toContain('sample-provider-key')

    expect(mocks.recordAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'provider.credentials_saved',
        actor,
        resource: { type: 'ProviderConnection', id: 'RESEND' },
        snapshot: expect.objectContaining({
          outcome: 'saved',
          provider: 'RESEND',
          state: 'CREDENTIALS_SAVED',
          source: 'db',
          category: 'EMAIL',
          fields: expect.objectContaining({
            provider: 'RESEND',
            submittedFields: ['apiKey', 'fromEmail'],
            fromEmail: 'store@example.com',
            containsSecretFields: true,
          }),
        }),
        redactions: expect.arrayContaining([
          'provider credential values',
          'API keys',
          'passwords',
          'webhook secrets',
        ]),
      })
    )
    expect(JSON.stringify(mocks.recordAuditLogBestEffort.mock.calls[0][0])).not.toContain(
      'sample-provider-key'
    )
  })

  it('preserves unsupported-provider response without auditing', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.parseSupportedProvider.mockReturnValue(null)

    const response = await POST(
      new Request('http://localhost/api/settings/providers/unknown/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sample-provider-key' }),
      }),
      { params: Promise.resolve({ provider: 'unknown' }) }
    )

    expect(response.status).toBe(404)
    expect(mocks.recordAuditLogBestEffort).not.toHaveBeenCalled()
  })

  it('saves Stripe credentials without returning raw secretKey or webhookSecret values', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.parseSupportedProvider.mockReturnValue('STRIPE')
    mocks.saveProviderCredentials.mockResolvedValue({
      provider: 'STRIPE',
      category: 'PAYMENT',
      integrationType: 'PAYMENT_STRIPE',
      state: 'CREDENTIALS_SAVED',
      source: 'db',
      hasCredentials: true,
      credentialMeta: [
        { key: 'PUBLISHABLE_KEY', present: true, maskedValue: 'pk_t••••st' },
        { key: 'SECRET_KEY', present: true, maskedValue: 'sk_t••••st' },
        { key: 'WEBHOOK_SECRET', present: true, maskedValue: 'whs••••ec' },
        { key: 'MODE', present: true, maskedValue: 'test' },
      ],
    })

    const response = await POST(
      new Request('http://localhost/api/settings/providers/stripe/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishableKey: 'pk_test_saved_key',
          secretKey: 'sk_test_saved_secret',
          webhookSecret: 'whsec_test_saved_secret',
          mode: 'test',
        }),
      }),
      { params: Promise.resolve({ provider: 'stripe' }) }
    )

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(mocks.saveProviderCredentials).toHaveBeenCalledWith('STRIPE', {
      publishableKey: 'pk_test_saved_key',
      secretKey: 'sk_test_saved_secret',
      webhookSecret: 'whsec_test_saved_secret',
      mode: 'test',
    })

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('sk_test_saved_secret')
    expect(serialized).not.toContain('whsec_test_saved_secret')

    expect(payload).toMatchObject({
      success: true,
      data: {
        provider: 'STRIPE',
        status: {
          state: 'CREDENTIALS_SAVED',
          source: 'db',
        },
      },
    })

    expect(mocks.recordAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'provider.credentials_saved',
        resource: { type: 'ProviderConnection', id: 'STRIPE' },
        snapshot: expect.objectContaining({
          provider: 'STRIPE',
          fields: expect.objectContaining({
            containsSecretFields: true,
            mode: 'test',
          }),
        }),
        redactions: expect.arrayContaining(['provider credential values', 'webhook secrets']),
      })
    )
  })
})

