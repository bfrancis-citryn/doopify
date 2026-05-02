import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  auditActorFromUser: vi.fn(),
  recordAuditLogBestEffort: vi.fn(),
  getEmailDeliveryById: vi.fn(),
  resendEmailDelivery: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/services/audit-log.service', () => ({
  auditActorFromUser: mocks.auditActorFromUser,
  recordAuditLogBestEffort: mocks.recordAuditLogBestEffort,
}))

vi.mock('@/server/services/email-delivery.service', () => ({
  getEmailDeliveryById: mocks.getEmailDeliveryById,
  resendEmailDelivery: mocks.resendEmailDelivery,
}))

import { POST } from './route'

describe('POST /api/email-deliveries/[id]/resend', () => {
  const actor = {
    actorType: 'STAFF',
    actorId: 'user-1',
    actorEmail: 'admin@example.com',
    actorRole: 'OWNER',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        firstName: null,
        lastName: null,
        role: 'OWNER',
      },
    })
    mocks.auditActorFromUser.mockReturnValue(actor)
    mocks.recordAuditLogBestEffort.mockResolvedValue({ id: 'audit-1' })
    mocks.getEmailDeliveryById.mockResolvedValue({
      delivery: {
        id: 'email-1',
        status: 'FAILED',
        template: 'order_confirmation',
        recipientEmail: 'customer@example.com',
        orderId: 'order-1',
      },
    })
  })

  it('records a best-effort audit event when resend creates a new delivery', async () => {
    mocks.resendEmailDelivery.mockResolvedValue({
      success: true,
      delivery: {
        id: 'email-2',
        status: 'SENT',
        template: 'order_confirmation',
        recipientEmail: 'customer@example.com',
        orderId: 'order-1',
      },
    })

    const response = await POST(
      new Request('http://localhost/api/email-deliveries/email-1/resend', { method: 'POST' }),
      { params: Promise.resolve({ id: 'email-1' }) }
    )

    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: 'email-2',
        status: 'SENT',
        template: 'order_confirmation',
        recipientEmail: 'customer@example.com',
        orderId: 'order-1',
      },
    })
    expect(response.status).toBe(200)
    expect(mocks.resendEmailDelivery).toHaveBeenCalledWith('email-1')
    expect(mocks.recordAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'email_delivery.resend_created',
        actor,
        resource: { type: 'EmailDelivery', id: 'email-1' },
        snapshot: expect.objectContaining({
          outcome: 'created',
          originalDeliveryId: 'email-1',
          originalStatus: 'FAILED',
          template: 'order_confirmation',
          recipientEmail: 'customer@example.com',
          orderId: 'order-1',
          newDeliveryId: 'email-2',
          newDeliveryStatus: 'SENT',
        }),
        redactions: expect.arrayContaining(['rendered email body', 'transport credentials']),
      })
    )
    expect(JSON.stringify(mocks.recordAuditLogBestEffort.mock.calls[0][0])).not.toContain('<p>')
  })

  it('records a best-effort audit event when resend is blocked', async () => {
    mocks.resendEmailDelivery.mockResolvedValue({
      success: false,
      reason: 'NOT_RESENDABLE',
      message: 'Only failed, bounced, or complained deliveries can be resent',
      blockers: ['Only failed, bounced, or complained deliveries can be resent'],
    })

    const response = await POST(
      new Request('http://localhost/api/email-deliveries/email-1/resend', { method: 'POST' }),
      { params: Promise.resolve({ id: 'email-1' }) }
    )

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Only failed, bounced, or complained deliveries can be resent',
    })
    expect(response.status).toBe(400)
    expect(mocks.recordAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'email_delivery.resend_blocked',
        actor,
        resource: { type: 'EmailDelivery', id: 'email-1' },
        snapshot: expect.objectContaining({
          outcome: 'blocked',
          reason: 'NOT_RESENDABLE',
          blockers: ['Only failed, bounced, or complained deliveries can be resent'],
          originalStatus: 'FAILED',
          template: 'order_confirmation',
          recipientEmail: 'customer@example.com',
          orderId: 'order-1',
        }),
      })
    )
  })

  it('preserves 404 response shape for missing deliveries and audits the attempt', async () => {
    mocks.getEmailDeliveryById.mockResolvedValue(null)
    mocks.resendEmailDelivery.mockResolvedValue({
      success: false,
      reason: 'NOT_FOUND',
      message: 'Email delivery not found',
    })

    const response = await POST(
      new Request('http://localhost/api/email-deliveries/email-missing/resend', { method: 'POST' }),
      { params: Promise.resolve({ id: 'email-missing' }) }
    )

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Email delivery not found',
    })
    expect(response.status).toBe(404)
    expect(mocks.recordAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'email_delivery.resend_blocked',
        resource: { type: 'EmailDelivery', id: 'email-missing' },
        snapshot: expect.objectContaining({
          outcome: 'blocked',
          reason: 'NOT_FOUND',
          originalStatus: null,
          template: null,
          recipientEmail: null,
          orderId: null,
        }),
      })
    )
  })
})
