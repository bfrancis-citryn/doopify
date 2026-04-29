import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAbandonedCheckoutSecret: vi.fn(),
  isAbandonedCheckoutCronAuthorized: vi.fn(),
  sendDueRecoveryEmails: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/abandoned-checkouts/auth', () => ({
  getAbandonedCheckoutSecret: mocks.getAbandonedCheckoutSecret,
  isAbandonedCheckoutCronAuthorized: mocks.isAbandonedCheckoutCronAuthorized,
}))

vi.mock('@/server/services/abandoned-checkout.service', () => ({
  sendDueRecoveryEmails: mocks.sendDueRecoveryEmails,
}))

import { POST } from './route'

describe('POST /api/abandoned-checkouts/send-due', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAbandonedCheckoutSecret.mockReturnValue('abandoned-secret')
    mocks.isAbandonedCheckoutCronAuthorized.mockReturnValue(false)
    mocks.sendDueRecoveryEmails.mockResolvedValue({
      markedAbandoned: 1,
      emailsAttempted: 1,
      emailsSent: 1,
      emailsFailed: 0,
      skipped: 0,
    })
  })

  it('requires a secret or admin session', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await POST(
      new Request('http://localhost/api/abandoned-checkouts/send-due?limit=25', { method: 'POST' })
    )

    expect(response.status).toBe(401)
    expect(mocks.sendDueRecoveryEmails).not.toHaveBeenCalled()
  })

  it('allows secret-authorized cron execution', async () => {
    mocks.isAbandonedCheckoutCronAuthorized.mockReturnValue(true)

    const response = await POST(
      new Request('http://localhost/api/abandoned-checkouts/send-due?limit=25', {
        method: 'POST',
        headers: {
          authorization: 'Bearer abandoned-secret',
        },
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.sendDueRecoveryEmails).toHaveBeenCalledWith({ limit: 25 })
  })
})
