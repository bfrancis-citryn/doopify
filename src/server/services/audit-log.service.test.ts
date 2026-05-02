import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    analyticsEvent: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))

import {
  auditActorFromUser,
  recordAuditLog,
  recordAuditLogBestEffort,
  redactAuditPayload,
} from './audit-log.service'

describe('audit log service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.analyticsEvent.create.mockResolvedValue({ id: 'audit-1' })
  })

  it('records a durable audit event with actor and resource context', async () => {
    await recordAuditLog({
      action: 'email_delivery.resend_created',
      actor: {
        actorType: 'STAFF',
        actorId: 'user-1',
        actorEmail: 'admin@example.com',
        actorRole: 'OWNER',
      },
      resource: { type: 'EmailDelivery', id: 'email-1' },
      summary: 'Email resend created delivery email-2',
      snapshot: {
        originalDeliveryId: 'email-1',
        newDeliveryId: 'email-2',
      },
      redactions: ['rendered email body'],
    })

    expect(mocks.prisma.analyticsEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: 'audit.email_delivery.resend_created',
        deliveryId: 'email-1',
        payload: expect.objectContaining({
          audit: true,
          action: 'email_delivery.resend_created',
          actor: {
            actorType: 'STAFF',
            actorId: 'user-1',
            actorEmail: 'admin@example.com',
            actorRole: 'OWNER',
          },
          resource: { type: 'EmailDelivery', id: 'email-1' },
          summary: 'Email resend created delivery email-2',
          snapshot: {
            originalDeliveryId: 'email-1',
            newDeliveryId: 'email-2',
          },
          redactions: ['rendered email body'],
        }),
      }),
    })
  })

  it('redacts secret-like and body/html fields from audit payloads', () => {
    const redacted = redactAuditPayload({
      provider: 'resend',
      apiKey: 're_live_secret',
      webhookSecret: 'whsec_secret',
      html: '<p>full customer email</p>',
      nested: {
        accessToken: 'token-value',
        safeValue: 'visible',
      },
    })

    expect(redacted).toEqual({
      provider: 'resend',
      apiKey: '[REDACTED]',
      webhookSecret: '[REDACTED]',
      html: '[REDACTED]',
      nested: {
        accessToken: '[REDACTED]',
        safeValue: 'visible',
      },
    })
  })

  it('does not throw when best-effort audit persistence fails', async () => {
    mocks.prisma.analyticsEvent.create.mockRejectedValue(new Error('database unavailable'))

    await expect(recordAuditLogBestEffort({
      action: 'email_delivery.resend_blocked',
      resource: { type: 'EmailDelivery', id: 'email-1' },
      summary: 'Email resend blocked',
      snapshot: { reason: 'NOT_RESENDABLE' },
    })).resolves.toBeNull()
  })

  it('maps authenticated users into safe audit actors', () => {
    expect(auditActorFromUser({
      id: 'user-1',
      email: 'admin@example.com',
      role: 'OWNER',
    })).toEqual({
      actorType: 'STAFF',
      actorId: 'user-1',
      actorEmail: 'admin@example.com',
      actorRole: 'OWNER',
    })
  })
})
