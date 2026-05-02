import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    integration: { findMany: vi.fn() },
    outboundWebhookDelivery: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  decrypt: vi.fn((value: string) => value),
  emitInternalEvent: vi.fn(),
  recordAuditLogBestEffort: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/utils/crypto', () => ({ decrypt: mocks.decrypt }))
vi.mock('@/server/events/dispatcher', () => ({ emitInternalEvent: mocks.emitInternalEvent }))
vi.mock('@/server/services/audit-log.service', () => ({
  recordAuditLogBestEffort: mocks.recordAuditLogBestEffort,
}))

import { retryOutboundWebhookDelivery } from './outbound-webhook.service'

const DELIVERY_ID = 'delivery-1'
const INTEGRATION_ID = 'int-1'
const WEBHOOK_URL = 'https://merchant.example/webhooks'

const baseExistingDelivery = {
  id: DELIVERY_ID,
  integrationId: INTEGRATION_ID,
  event: 'order.paid',
  payload: '{"event":"order.paid"}',
  status: 'EXHAUSTED' as const,
  attempts: 4,
  nextRetryAt: null,
  integration: {
    id: INTEGRATION_ID,
    status: 'ACTIVE',
    webhookUrl: WEBHOOK_URL,
    webhookSecret: null,
    secrets: [],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  global.fetch = vi.fn()
  mocks.prisma.outboundWebhookDelivery.updateMany.mockResolvedValue({ count: 1 })
  mocks.recordAuditLogBestEffort.mockResolvedValue(null)
  mocks.emitInternalEvent.mockResolvedValue(undefined)
})

describe('retryOutboundWebhookDelivery — audit logging', () => {
  it('emits a manual retry audit event with actor, direction, and status transition after a successful retry', async () => {
    mocks.prisma.outboundWebhookDelivery.findUnique
      .mockResolvedValueOnce(baseExistingDelivery)
      .mockResolvedValueOnce({
        ...baseExistingDelivery,
        status: 'PENDING',
        attempts: 4,
      })
    mocks.prisma.outboundWebhookDelivery.update
      .mockResolvedValueOnce({ id: DELIVERY_ID, status: 'PENDING', nextRetryAt: null, processedAt: null, lastError: null })
      .mockResolvedValueOnce({ id: DELIVERY_ID, status: 'SUCCESS', attempts: 5, statusCode: 200, responseBody: 'ok', lastError: null })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'ok',
    })

    await retryOutboundWebhookDelivery(DELIVERY_ID, {
      actorType: 'STAFF',
      actorId: 'user-1',
      actorEmail: 'admin@example.com',
      actorRole: 'OWNER',
    })

    expect(mocks.recordAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'outbound_webhook.manual_retry',
        actor: expect.objectContaining({
          actorType: 'STAFF',
          actorId: 'user-1',
          actorEmail: 'admin@example.com',
          actorRole: 'OWNER',
        }),
        resource: { type: 'OutboundWebhookDelivery', id: DELIVERY_ID },
        snapshot: expect.objectContaining({
          deliveryId: DELIVERY_ID,
          integrationId: INTEGRATION_ID,
          eventType: 'order.paid',
          direction: 'outbound',
          previousStatus: 'EXHAUSTED',
          targetUrlHost: 'merchant.example',
        }),
      })
    )
  })

  it('includes only the host name (not full URL) in the audit snapshot', async () => {
    const deliveryWithPath = {
      ...baseExistingDelivery,
      status: 'FAILED' as const,
      integration: {
        ...baseExistingDelivery.integration,
        webhookUrl: 'https://api.example.com:8443/hooks/webhook?token=secret',
      },
    }
    mocks.prisma.outboundWebhookDelivery.findUnique
      .mockResolvedValueOnce(deliveryWithPath)
      .mockResolvedValueOnce({ ...deliveryWithPath, status: 'PENDING' })
    mocks.prisma.outboundWebhookDelivery.update
      .mockResolvedValueOnce({ id: DELIVERY_ID, status: 'PENDING', nextRetryAt: null, processedAt: null, lastError: null })
      .mockResolvedValueOnce({ id: DELIVERY_ID, status: 'SUCCESS', attempts: 1, statusCode: 200, responseBody: 'ok', lastError: null })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'ok',
    })

    await retryOutboundWebhookDelivery(DELIVERY_ID)

    const auditCall = mocks.recordAuditLogBestEffort.mock.calls[0]
    const auditInput = auditCall[0] as { snapshot: Record<string, unknown> }
    // Only the host (plus port) should appear, not path, query params, or tokens.
    expect(auditInput.snapshot.targetUrlHost).toBe('api.example.com:8443')
    expect(JSON.stringify(auditInput.snapshot)).not.toContain('token=secret')
    expect(JSON.stringify(auditInput.snapshot)).not.toContain('/hooks/webhook')
  })

  it('does not store raw payload, signing secret, or full provider response body in audit snapshot', async () => {
    mocks.prisma.outboundWebhookDelivery.findUnique
      .mockResolvedValueOnce({
        ...baseExistingDelivery,
        status: 'FAILED' as const,
        integration: {
          ...baseExistingDelivery.integration,
          webhookSecret: 'encrypted-super-secret-value',
        },
      })
      .mockResolvedValueOnce({
        ...baseExistingDelivery,
        status: 'PENDING',
        integration: {
          ...baseExistingDelivery.integration,
          webhookSecret: 'encrypted-super-secret-value',
        },
      })
    mocks.prisma.outboundWebhookDelivery.update
      .mockResolvedValueOnce({ id: DELIVERY_ID, status: 'PENDING', nextRetryAt: null, processedAt: null, lastError: null })
      .mockResolvedValueOnce({ id: DELIVERY_ID, status: 'SUCCESS', attempts: 1, statusCode: 200, responseBody: '{"ok":true,"secret":"leaked"}', lastError: null })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true,"secret":"leaked"}',
    })

    await retryOutboundWebhookDelivery(DELIVERY_ID)

    const auditCall = mocks.recordAuditLogBestEffort.mock.calls[0]
    const auditInput = auditCall[0] as { snapshot: Record<string, unknown> }
    const snapshotStr = JSON.stringify(auditInput.snapshot)

    // Raw payload, secret, and raw provider response body must not appear
    expect(snapshotStr).not.toContain('encrypted-super-secret-value')
    expect(snapshotStr).not.toContain('"payload"')
    expect(snapshotStr).not.toContain('"responseBody"')
    expect(snapshotStr).not.toContain('leaked')
    // The raw payload JSON body must not appear — the event type label is safe metadata but
    // the full payload string (e.g. '{"event":"order.paid","data":{...}}') must not be stored.
    expect(snapshotStr).not.toContain(baseExistingDelivery.payload)
    // The redactions label must be present
    const redactions = (auditCall[0] as { redactions?: string[] }).redactions ?? []
    expect(redactions).toEqual(
      expect.arrayContaining(['signing secret', 'custom header secrets', 'raw payload'])
    )
  })

  it('does not fail the retry flow when audit logging throws', async () => {
    mocks.prisma.outboundWebhookDelivery.findUnique
      .mockResolvedValueOnce(baseExistingDelivery)
      .mockResolvedValueOnce({ ...baseExistingDelivery, status: 'PENDING' })
    mocks.prisma.outboundWebhookDelivery.update
      .mockResolvedValueOnce({ id: DELIVERY_ID, status: 'PENDING', nextRetryAt: null, processedAt: null, lastError: null })
      .mockResolvedValueOnce({ id: DELIVERY_ID, status: 'SUCCESS', attempts: 5, statusCode: 200, responseBody: 'ok', lastError: null })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'ok',
    })
    mocks.recordAuditLogBestEffort.mockRejectedValue(new Error('audit store unavailable'))

    // Should resolve successfully despite audit failure
    const result = await retryOutboundWebhookDelivery(DELIVERY_ID)
    expect(result).not.toBeNull()
    expect(result?.status).toBe('SUCCESS')
  })

  it('returns null and does not emit an audit event for non-retryable deliveries', async () => {
    mocks.prisma.outboundWebhookDelivery.findUnique.mockResolvedValue({
      id: DELIVERY_ID,
      status: 'SUCCESS',
      event: 'order.paid',
      attempts: 1,
      integrationId: INTEGRATION_ID,
      integration: { webhookUrl: WEBHOOK_URL },
    })

    const result = await retryOutboundWebhookDelivery(DELIVERY_ID)

    expect(result).toBeNull()
    expect(mocks.recordAuditLogBestEffort).not.toHaveBeenCalled()
  })
})
