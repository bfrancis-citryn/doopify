import { verifyStripeWebhookSignature } from '@/lib/stripe'
import {
  markWebhookDeliveryFailed,
  markWebhookDeliveryProcessed,
  recordWebhookDeliveryAttempt,
  storeVerifiedWebhookPayload,
} from '@/server/services/webhook-delivery.service'
import { parseStripeWebhookEventPayload, processStripeWebhookEvent } from '@/server/services/stripe-webhook.service'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const payload = await req.text()
  const signature = req.headers.get('stripe-signature')
  const event = parseStripeWebhookEventPayload(payload)
  const delivery = await recordWebhookDeliveryAttempt({
    provider: 'stripe',
    providerEventId: event?.id,
    eventType: event?.type,
    payload,
  })

  try {
    verifyStripeWebhookSignature(payload, signature)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook signature verification failed'
    await markWebhookDeliveryFailed({
      provider: 'stripe',
      providerEventId: delivery.providerEventId,
      status: 'SIGNATURE_FAILED',
      error: message,
    })
    return new Response(message, { status: 400 })
  }

  if (!event) {
    await markWebhookDeliveryFailed({
      provider: 'stripe',
      providerEventId: delivery.providerEventId,
      error: 'Invalid Stripe webhook payload',
      retryable: false,
    })
    return new Response('Invalid Stripe webhook payload', { status: 400 })
  }

  await storeVerifiedWebhookPayload({
    provider: 'stripe',
    providerEventId: delivery.providerEventId,
    rawPayload: payload,
  })

  try {
    await processStripeWebhookEvent(event)

    await markWebhookDeliveryProcessed({
      provider: 'stripe',
      providerEventId: delivery.providerEventId,
    })
    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[POST /api/webhooks/stripe]', error)
    await markWebhookDeliveryFailed({
      provider: 'stripe',
      providerEventId: delivery.providerEventId,
      error: error instanceof Error ? error.message : 'Webhook processing failed',
      retryable: true,
    })
    return new Response('Webhook processing failed', { status: 500 })
  }
}
