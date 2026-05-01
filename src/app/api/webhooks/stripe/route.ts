import { verifyStripeWebhookSignature } from '@/lib/stripe'
import {
  getStripeRuntimeConnection,
  getStripeWebhookSecretSelection,
} from '@/server/payments/stripe-runtime.service'
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

  let stripeRuntime: Awaited<ReturnType<typeof getStripeRuntimeConnection>>
  let webhookSecretSelection: Awaited<ReturnType<typeof getStripeWebhookSecretSelection>>
  try {
    stripeRuntime = await getStripeRuntimeConnection()
    webhookSecretSelection = await getStripeWebhookSecretSelection()
  } catch (error) {
    const message = 'Failed to resolve Stripe runtime configuration for webhook verification'
    await markWebhookDeliveryFailed({
      provider: 'stripe',
      providerEventId: delivery.providerEventId,
      error: message,
      retryable: false,
    })
    console.error('[POST /api/webhooks/stripe] Runtime resolution failed', error)
    return new Response(message, { status: 503 })
  }

  console.info(
    `[webhooks/stripe] Stripe runtime source: ${stripeRuntime.source}; mode: ${stripeRuntime.mode ?? 'unknown'}; webhook secret source: ${webhookSecretSelection.source}`
  )

  if (!webhookSecretSelection.webhookSecret) {
    const message =
      'Stripe webhook signing secret is not configured. Verify Stripe in Settings -> Payments or set STRIPE_WEBHOOK_SECRET.'
    await markWebhookDeliveryFailed({
      provider: 'stripe',
      providerEventId: delivery.providerEventId,
      error: message,
      retryable: false,
    })
    return new Response(message, { status: 503 })
  }

  try {
    verifyStripeWebhookSignature(payload, signature, webhookSecretSelection.webhookSecret)
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
