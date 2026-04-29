import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  disconnectShippingProvider: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/shipping/shipping-provider.service', () => ({
  disconnectShippingProvider: mocks.disconnectShippingProvider,
}))

import { POST } from './route'

describe('settings shipping disconnect-provider route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST requires admin auth', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
    })

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/disconnect-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'SHIPPO' }),
      })
    )

    expect(response.status).toBe(403)
    expect(mocks.disconnectShippingProvider).not.toHaveBeenCalled()
  })

  it('disconnects provider and returns status', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff_1', email: 'staff@example.com', role: 'STAFF' },
    })
    mocks.disconnectShippingProvider.mockResolvedValue({
      provider: 'SHIPPO',
      integrationType: 'SHIPPING_SHIPPO',
      integrationId: 'int_2',
      integrationStatus: 'INACTIVE',
      hasCredentials: true,
      connected: false,
      updatedAt: '2026-04-29T18:31:00.000Z',
    })

    const response = await POST(
      new Request('http://localhost/api/settings/shipping/disconnect-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'SHIPPO', clearCredentials: true }),
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload).toMatchObject({
      success: true,
      data: {
        provider: 'SHIPPO',
        status: {
          integrationStatus: 'INACTIVE',
          connected: false,
        },
      },
    })
  })
})
