import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getWebhookDeliveryById: vi.fn(),
  recordWebhookDeliveryAttempt: vi.fn(),
  markWebhookDeliveryProcessed: vi.fn(),
  markWebhookDeliveryFailed: vi.fn(),
  processStripeWebhookEvent: vi.fn(),
  requireAdmin: vi.fn(),
  recordAuditLogBestEffort: vi.fn(),
  auditActorFromUser: vi.fn(),
}))

vi.mock('@/server/services/webhook-delivery.service', () => ({
  getWebhookDeliveryById: mocks.getWebhookDeliveryById,
  recordWebhookDeliveryAttempt: mocks.recordWebhookDeliveryAttempt,
  markWebhookDeliveryProcessed: mocks.markWebhookDeliveryProcessed,
  markWebhookDeliveryFailed: mocks.markWebhookDeliveryFailed,
}))

vi.mock('@/server/services/stripe-webhook.service', () => ({
  parseStripeWebhookEventPayload: (payload: string) => {
    try {
      return JSON.parse(payload)
    } catch {
      return null
    }
  },
  processStripeWebhookEvent: mocks.processStripeWebhookEvent,
}))
vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))
vi.mock('@/server/services/audit-log.service', () => ({
  recordAuditLogBestEffort: mocks.recordAuditLogBestEffort,
  auditActorFromUser: mocks.auditActorFromUser,
}))

import { POST } from './route'

const STAFF_USER = { id: 'staff-1', email: 'staff@example.com', firstName: null, lastName: null, role: 'STAFF' as const }
const STAFF_ACTOR = {
  actorType: 'STAFF' as const,
  actorId: 'staff-1',
  actorEmail: 'staff@example.com',
  actorRole: 'STAFF',
}

const DELIVERY_ID = 'delivery_1'
const RAW_PAYLOAD = JSON.stringify({
  id: 'evt_1',
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: 'pi_1',
      amount: 5999,
      currency: 'usd',
      status: 'succeeded',
    },
  },
})

const baseDelivery = {
  id: DELIVERY_ID,
  provider: 'stripe',
  providerEventId: 'evt_1',
  eventType: 'payment_intent.succeeded',
  status: 'FAILED',
  attempts: 2,
  rawPayload: RAW_PAYLOAD,
}

const replayAttempt = {
  id: DELIVERY_ID,
  provider: 'stripe',
  providerEventId: 'evt_1',
  eventType: 'payment_intent.succeeded',
  status: 'RECEIVED',
  attempts: 3,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdmin.mockResolvedValue({ ok: true, user: STAFF_USER })
  mocks.auditActorFromUser.mockReturnValue(STAFF_ACTOR)
  mocks.getWebhookDeliveryById.mockResolvedValue(baseDelivery)
  mocks.recordWebhookDeliveryAttempt.mockResolvedValue(replayAttempt)
  mocks.markWebhookDeliveryProcessed.mockResolvedValue({ ...replayAttempt, status: 'PROCESSED' })
  mocks.processStripeWebhookEvent.mockResolvedValue(undefined)
  mocks.recordAuditLogBestEffort.mockResolvedValue(null)
})

describe('POST /api/webhook-deliveries/[id]/replay — audit logging', () => {
  it('emits an inbound_webhook.manual_replay audit event on successful replay', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhook-deliveries/delivery_1/replay'),
      { params: Promise.resolve({ id: DELIVERY_ID }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.recordAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inbound_webhook.manual_replay',
        actor: STAFF_ACTOR,
        resource: { type: 'WebhookDelivery', id: DELIVERY_ID },
        snapshot: expect.objectContaining({
          deliveryId: DELIVERY_ID,
          provider: 'stripe',
          providerEventId: 'evt_1',
          eventType: 'payment_intent.succeeded',
          direction: 'inbound',
          previousStatus: 'FAILED',
          newStatus: 'PROCESSED',
          attemptCount: replayAttempt.attempts,
        }),
      })
    )
  })

  it('emits an inbound_webhook.manual_replay_failed audit event when processing fails', async () => {
    mocks.processStripeWebhookEvent.mockRejectedValue(new Error('Order finalization failed'))

    const response = await POST(
      new Request('http://localhost/api/webhook-deliveries/delivery_1/replay'),
      { params: Promise.resolve({ id: DELIVERY_ID }) }
    )

    expect(response.status).toBe(500)
    expect(mocks.recordAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inbound_webhook.manual_replay_failed',
        actor: STAFF_ACTOR,
        resource: { type: 'WebhookDelivery', id: DELIVERY_ID },
        snapshot: expect.objectContaining({
          deliveryId: DELIVERY_ID,
          provider: 'stripe',
          providerEventId: 'evt_1',
          eventType: 'payment_intent.succeeded',
          direction: 'inbound',
          previousStatus: 'FAILED',
          errorMessage: 'Order finalization failed',
        }),
      })
    )
  })

  it('does not include raw payload, signature, or provider secrets in audit snapshot', async () => {
    await POST(
      new Request('http://localhost/api/webhook-deliveries/delivery_1/replay'),
      { params: Promise.resolve({ id: DELIVERY_ID }) }
    )

    const auditCall = mocks.recordAuditLogBestEffort.mock.calls[0]
    const auditInput = auditCall[0] as { snapshot: Record<string, unknown>; redactions?: string[] }
    const snapshotStr = JSON.stringify(auditInput.snapshot)

    // Raw payload content (card data, full provider event body) must not appear
    expect(snapshotStr).not.toContain('pi_1')
    expect(snapshotStr).not.toContain('"amount"')
    expect(snapshotStr).not.toContain('usd')
    expect(snapshotStr).not.toContain('rawPayload')
    expect(snapshotStr).not.toContain('webhookSecret')

    // Redaction labels present
    const redactions = auditInput.redactions ?? []
    expect(redactions).toEqual(
      expect.arrayContaining(['raw payload', 'webhook signature', 'provider secrets'])
    )
  })

  it('does not fail the replay flow when audit logging throws', async () => {
    mocks.recordAuditLogBestEffort.mockRejectedValue(new Error('audit store unavailable'))

    const response = await POST(
      new Request('http://localhost/api/webhook-deliveries/delivery_1/replay'),
      { params: Promise.resolve({ id: DELIVERY_ID }) }
    )

    // Replay must still succeed and return the correct shape
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.data).toMatchObject({
      id: DELIVERY_ID,
      provider: 'stripe',
      providerEventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      status: 'PROCESSED',
    })
    // markWebhookDeliveryProcessed must still have been called
    expect(mocks.markWebhookDeliveryProcessed).toHaveBeenCalledWith({
      provider: 'stripe',
      providerEventId: 'evt_1',
    })
  })
})
