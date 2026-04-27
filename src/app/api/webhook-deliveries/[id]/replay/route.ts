import { err, ok } from '@/lib/api'
import { getStripeEvent } from '@/lib/stripe'
import {
  getWebhookDeliveryById,
  markWebhookDeliveryFailed,
  markWebhookDeliveryProcessed,
  recordWebhookDeliveryAttempt,
} from '@/server/services/webhook-delivery.service'
import { processStripeWebhookEvent } from '@/server/services/stripe-webhook.service'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params

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

  let replayEvent
  try {
    replayEvent = await getStripeEvent(delivery.providerEventId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Stripe event'
    await markWebhookDeliveryFailed({
      provider: delivery.provider,
      providerEventId: delivery.providerEventId,
      error: message,
    })
    return err('Failed to fetch webhook event from Stripe', 500)
  }

  const replayAttempt = await recordWebhookDeliveryAttempt({
    provider: delivery.provider,
    providerEventId: replayEvent.id,
    eventType: replayEvent.type,
    payload: JSON.stringify(replayEvent),
  })

  try {
    await processStripeWebhookEvent(replayEvent)
    await markWebhookDeliveryProcessed({
      provider: replayAttempt.provider,
      providerEventId: replayAttempt.providerEventId,
    })

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
    })
    return err('Webhook replay failed', 500)
  }
}
