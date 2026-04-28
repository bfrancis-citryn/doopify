import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyWebhook: vi.fn(),
  recordWebhookDeliveryAttempt: vi.fn(),
  storeVerifiedWebhookPayload: vi.fn(),
  markWebhookDeliveryProcessed: vi.fn(),
  markWebhookDeliveryFailed: vi.fn(),
  applyEmailProviderWebhookEvent: vi.fn(),
  env: {
    RESEND_WEBHOOK_SECRET: 'whsec_test' as string | undefined,
  },
}))

vi.mock('svix', () => ({
  Webhook: class {
    verify(payload: string, headers: { id: string; timestamp: string; signature: string }) {
      return mocks.verifyWebhook(payload, headers)
    }
  },
}))

vi.mock('@/lib/env', () => ({
  env: mocks.env,
}))

vi.mock('@/server/services/webhook-delivery.service', () => ({
  recordWebhookDeliveryAttempt: mocks.recordWebhookDeliveryAttempt,
  storeVerifiedWebhookPayload: mocks.storeVerifiedWebhookPayload,
  markWebhookDeliveryProcessed: mocks.markWebhookDeliveryProcessed,
  markWebhookDeliveryFailed: mocks.markWebhookDeliveryFailed,
}))

vi.mock('@/server/services/email-delivery.service', () => ({
  parseEmailProviderWebhookPayload: (payload: string) => {
    try {
      const event = JSON.parse(payload)
      if (!event || typeof event !== 'object') return null
      if (typeof event.type !== 'string') return null
      return event
    } catch {
      return null
    }
  },
  applyEmailProviderWebhookEvent: mocks.applyEmailProviderWebhookEvent,
}))

import { POST } from './route'

describe('POST /api/webhooks/email-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyWebhook.mockImplementation(() => undefined)
    mocks.recordWebhookDeliveryAttempt.mockResolvedValue({
      provider: 'resend',
      providerEventId: 'msg_123',
    })
    mocks.applyEmailProviderWebhookEvent.mockResolvedValue({ handled: true })
    mocks.env.RESEND_WEBHOOK_SECRET = 'whsec_test'
  })

  it('rejects invalid signature before processing event', async () => {
    mocks.verifyWebhook.mockImplementation(() => {
      throw new Error('Signature verification failed')
    })

    const response = await POST(
      new Request('http://localhost/api/webhooks/email-provider', {
        method: 'POST',
        headers: {
          'svix-id': 'msg_123',
          'svix-timestamp': '1714341000',
          'svix-signature': 'v1,invalid',
        },
        body: JSON.stringify({
          type: 'email.bounced',
          data: { email_id: 'email_123' },
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Signature verification failed')
    expect(mocks.applyEmailProviderWebhookEvent).not.toHaveBeenCalled()
    expect(mocks.markWebhookDeliveryFailed).toHaveBeenCalledWith({
      provider: 'resend',
      providerEventId: 'msg_123',
      status: 'SIGNATURE_FAILED',
      error: 'Signature verification failed',
    })
  })

  it('rejects malformed payloads', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhooks/email-provider', {
        method: 'POST',
        headers: {
          'svix-id': 'msg_123',
          'svix-timestamp': '1714341000',
          'svix-signature': 'v1,valid',
        },
        body: '{"not":"an_event"}',
      })
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Invalid email provider webhook payload')
    expect(mocks.storeVerifiedWebhookPayload).not.toHaveBeenCalled()
    expect(mocks.markWebhookDeliveryFailed).toHaveBeenCalledWith({
      provider: 'resend',
      providerEventId: 'msg_123',
      error: 'Invalid email provider webhook payload',
      retryable: false,
    })
  })

  it('processes verified webhook events', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhooks/email-provider', {
        method: 'POST',
        headers: {
          'svix-id': 'msg_123',
          'svix-timestamp': '1714341000',
          'svix-signature': 'v1,valid',
        },
        body: JSON.stringify({
          type: 'email.complained',
          data: { email_id: 'email_123' },
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
    expect(mocks.applyEmailProviderWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.complained' })
    )
    expect(mocks.storeVerifiedWebhookPayload).toHaveBeenCalledWith({
      provider: 'resend',
      providerEventId: 'msg_123',
      rawPayload: expect.stringContaining('email.complained'),
    })
    expect(mocks.markWebhookDeliveryProcessed).toHaveBeenCalledWith({
      provider: 'resend',
      providerEventId: 'msg_123',
    })
  })

  it('marks failed processing for unexpected errors', async () => {
    mocks.applyEmailProviderWebhookEvent.mockRejectedValue(new Error('Database unavailable'))

    const response = await POST(
      new Request('http://localhost/api/webhooks/email-provider', {
        method: 'POST',
        headers: {
          'svix-id': 'msg_123',
          'svix-timestamp': '1714341000',
          'svix-signature': 'v1,valid',
        },
        body: JSON.stringify({
          type: 'email.bounced',
          data: { email_id: 'email_123' },
        }),
      })
    )

    expect(response.status).toBe(500)
    expect(await response.text()).toBe('Webhook processing failed')
    expect(mocks.markWebhookDeliveryFailed).toHaveBeenCalledWith({
      provider: 'resend',
      providerEventId: 'msg_123',
      error: 'Database unavailable',
      retryable: true,
    })
  })

  it('rejects verified requests when webhook secret is missing', async () => {
    mocks.env.RESEND_WEBHOOK_SECRET = undefined

    const response = await POST(
      new Request('http://localhost/api/webhooks/email-provider', {
        method: 'POST',
        headers: {
          'svix-id': 'msg_123',
          'svix-timestamp': '1714341000',
          'svix-signature': 'v1,valid',
        },
        body: JSON.stringify({
          type: 'email.bounced',
          data: { email_id: 'email_123' },
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('RESEND_WEBHOOK_SECRET is not configured')
    expect(mocks.markWebhookDeliveryFailed).toHaveBeenCalledWith({
      provider: 'resend',
      providerEventId: 'msg_123',
      status: 'SIGNATURE_FAILED',
      error: 'RESEND_WEBHOOK_SECRET is not configured',
    })
  })
})
