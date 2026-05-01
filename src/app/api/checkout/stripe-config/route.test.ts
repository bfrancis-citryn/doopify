import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStripeRuntimeConnection: vi.fn(),
}))

vi.mock('@/server/payments/stripe-runtime.service', () => ({
  getStripeRuntimeConnection: mocks.getStripeRuntimeConnection,
}))

import { GET } from './route'

describe('GET /api/checkout/stripe-config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns publishable key with source and mode only', async () => {
    mocks.getStripeRuntimeConnection.mockResolvedValue({
      source: 'env',
      verified: false,
      mode: 'test',
      publishableKey: 'pk_test_public',
      secretKey: 'sk_test_hidden',
      webhookSecret: 'whsec_hidden',
      accountId: null,
      chargesEnabled: null,
      payoutsEnabled: null,
    })

    const response = await GET()
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload).toEqual({
      success: true,
      data: {
        publishableKey: 'pk_test_public',
        source: 'env',
        mode: 'test',
      },
    })

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('sk_test_hidden')
    expect(serialized).not.toContain('whsec_hidden')
  })
})