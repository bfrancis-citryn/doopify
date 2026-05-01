import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  parseSupportedProvider: vi.fn(),
  sendProviderTestEmail: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireOwner: mocks.requireOwner,
}))

vi.mock('@/server/services/provider-connection.service', () => ({
  parseSupportedProvider: mocks.parseSupportedProvider,
  sendProviderTestEmail: mocks.sendProviderTestEmail,
}))

import { POST } from './route'

describe('settings providers test-email route', () => {
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
      new Request('http://localhost/api/settings/providers/resend/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: 'owner@example.com' }),
      }),
      { params: Promise.resolve({ provider: 'resend' }) }
    )

    expect(response.status).toBe(401)
    expect(mocks.sendProviderTestEmail).not.toHaveBeenCalled()
  })

  it('sends a provider test email for valid payloads', async () => {
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      user: { id: 'owner_1', email: 'owner@example.com', role: 'OWNER' },
    })
    mocks.sendProviderTestEmail.mockResolvedValue({
      provider: 'RESEND',
      source: 'db',
      toEmail: 'owner@example.com',
      fromEmail: 'store@example.com',
      messageId: 'msg_1',
    })

    const response = await POST(
      new Request('http://localhost/api/settings/providers/resend/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: 'owner@example.com', fromEmail: 'store@example.com' }),
      }),
      { params: Promise.resolve({ provider: 'resend' }) }
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(mocks.sendProviderTestEmail).toHaveBeenCalledWith({
      provider: 'RESEND',
      toEmail: 'owner@example.com',
      fromEmail: 'store@example.com',
    })
    expect(payload).toMatchObject({
      success: true,
      data: {
        provider: 'RESEND',
        result: {
          messageId: 'msg_1',
        },
      },
    })
  })
})

