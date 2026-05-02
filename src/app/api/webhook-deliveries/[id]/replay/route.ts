import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import {
  getWebhookDeliveryById,
  markWebhookDeliveryFailed,
  markWebhookDeliveryProcessed,
  recordWebhookDeliveryAttempt,
} from '@/server/services/webhook-delivery.service'
import { parseStripeWebhookEventPayload, processStripeWebhookEvent } from '@/server/services/stripe-webhook.service'
import { auditActorFromUser, recordAuditLogBestEffort } from '@/server/services/audit-log.service'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const actor = auditActorFromUser(auth.user)

  const delivery = await getWebhookDeliveryById(id)
  if (!delivery) {
    return err('Webhook delivery not found', 404)
  }

  if (delivery.provider !== 'stripe') {
    return err('Replay is only supported for Stripe deliveries', 400)
  }

  if (delivery.providerEventId.startsWith('unknown:')) {
    return err('Replay requires a provider event id', 400)
  }

  if (!delivery.rawPayload) {
    return err('Replay requires a verified stored payload', 400)
  }

  const replayEvent = parseStripeWebhookEventPayload(delivery.rawPayload)
  if (!replayEvent) {
    await markWebhookDeliveryFailed({
      provider: delivery.provider,
      providerEventId: delivery.providerEventId,
      error: 'Stored webhook payload is invalid',
      retryable: false,
    })
    return err('Stored webhook payload is invalid', 400)
  }

  const previousStatus = delivery.status
  const replayAttempt = await recordWebhookDeliveryAttempt({
    provider: delivery.provider,
    providerEventId: replayEvent.id,
    eventType: replayEvent.type,
    payload: delivery.rawPayload,
    rawPayload: delivery.rawPayload,
    isRetry: true,
  })

  try {
    await processStripeWebhookEvent(replayEvent)
    await markWebhookDeliveryProcessed({
      provider: replayAttempt.provider,
      providerEventId: replayAttempt.providerEventId,
    })

    try {
      await recordAuditLogBestEffort({
        action: 'inbound_webhook.manual_replay',
        actor,
        resource: { type: 'WebhookDelivery', id: replayAttempt.id },
        summary: 'Manual replay succeeded for inbound delivery ' + replayAttempt.id + ' (' + replayAttempt.eventType + ')',
        snapshot: {
          deliveryId: replayAttempt.id,
          provider: replayAttempt.provider,
          providerEventId: replayAttempt.providerEventId,
          eventType: replayAttempt.eventType,
          direction: 'inbound',
          previousStatus,
          newStatus: 'PROCESSED',
          attemptCount: replayAttempt.attempts,
        },
        redactions: ['raw payload', 'webhook signature', 'provider secrets'],
      })
    } catch (auditError) {
      console.error('[replay-route] Audit emission failed', { deliveryId: replayAttempt.id, error: auditError })
    }

    return ok({
      id: replayAttempt.id,
      provider: replayAttempt.provider,
      providerEventId: replayAttempt.providerEventId,
      eventType: replayAttempt.eventType,
      status: 'PROCESSED',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook replay failed'
    await markWebhookDeliveryFailed({
      provider: replayAttempt.provider,
      providerEventId: replayAttempt.providerEventId,
      error: message,
      retryable: true,
    })

    try {
      await recordAuditLogBestEffort({
        action: 'inbound_webhook.manual_replay_failed',
        actor,
        resource: { type: 'WebhookDelivery', id: replayAttempt.id },
        summary: 'Manual replay failed for inbound delivery ' + replayAttempt.id + ' (' + replayAttempt.eventType + ')',
        snapshot: {
          deliveryId: replayAttempt.id,
          provider: replayAttempt.provider,
          providerEventId: replayAttempt.providerEventId,
          eventType: replayAttempt.eventType,
          direction: 'inbound',
          previousStatus,
          newStatus: 'RETRY_PENDING',
          attemptCount: replayAttempt.attempts,
          errorMessage: message,
        },
        redactions: ['raw payload', 'webhook signature', 'provider secrets'],
      })
    } catch (auditError) {
      console.error('[replay-route] Audit emission failed on replay error', { deliveryId: replayAttempt.id, error: auditError })
    }

    return err('Webhook replay failed', 500)
  }
}
