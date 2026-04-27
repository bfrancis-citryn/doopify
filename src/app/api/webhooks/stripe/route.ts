import { type StripePaymentIntent, type StripeWebhookEvent, verifyStripeWebhookSignature } from '@/lib/stripe'
import {
  markWebhookDeliveryFailed,
  markWebhookDeliveryProcessed,
  recordWebhookDeliveryAttempt,
} from '@/server/services/webhook-delivery.service'
import { processStripeWebhookEvent } from '@/server/services/stripe-webhook.service'

export const runtime = 'nodejs'

function safeParseWebhookEvent(payload: string): StripeWebhookEvent<StripePaymentIntent> | null {
  try {
    const event = JSON.parse(payload)
    if (!event || typeof event !== 'object') return null
    if (typeof event.id !== 'string' || typeof event.type !== 'string') return null
    if (!event.data || typeof event.data !== 'object' || !('object' in event.data)) return null
    return event as StripeWebhookEvent<StripePaymentIntent>
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const payload = await req.text()
  const signature = req.headers.get('stripe-signature')
  const event = safeParseWebhookEvent(payload)
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
    })
    return new Response('Invalid Stripe webhook payload', { status: 400 })
  }

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
    })
    return new Response('Webhook processing failed', { status: 500 })
  }
}
