import {
  markWebhookDeliveryFailed,
  markWebhookDeliveryProcessed,
  recordWebhookDeliveryAttempt,
  storeVerifiedWebhookPayload,
} from '@/server/services/webhook-delivery.service'
import {
  applyShippingProviderTrackingWebhookEvent,
  parseShippingProviderWebhookPayload,
  verifyShippingProviderWebhookSignature,
} from '@/server/shipping/shipping-tracking-webhook.service'

export const runtime = 'nodejs'

function resolveProvider(url: URL) {
  const raw = String(url.searchParams.get('provider') ?? '')
    .trim()
    .toUpperCase()

  if (raw === 'EASYPOST') return 'EASYPOST' as const
  if (raw === 'SHIPPO') return 'SHIPPO' as const
  return null
}

function providerWebhookName(provider: 'EASYPOST' | 'SHIPPO') {
  return provider === 'EASYPOST' ? 'shipping.easypost' : 'shipping.shippo'
}

export async function POST(req: Request) {
  const provider = resolveProvider(new URL(req.url))
  if (!provider) {
    return new Response('Shipping provider query is required (provider=EASYPOST|SHIPPO)', { status: 400 })
  }

  const payload = await req.text()
  const parsedEvent = parseShippingProviderWebhookPayload({
    provider,
    payload,
  })
  const delivery = await recordWebhookDeliveryAttempt({
    provider: providerWebhookName(provider),
    providerEventId: parsedEvent?.providerEventId,
    eventType: parsedEvent?.eventType,
    payload,
  })

  try {
    verifyShippingProviderWebhookSignature({
      provider,
      payload,
      headers: req.headers,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook signature verification failed'
    await markWebhookDeliveryFailed({
      provider: providerWebhookName(provider),
      providerEventId: delivery.providerEventId,
      status: 'SIGNATURE_FAILED',
      error: message,
    })
    return new Response(message, { status: 400 })
  }

  if (!parsedEvent) {
    await markWebhookDeliveryFailed({
      provider: providerWebhookName(provider),
      providerEventId: delivery.providerEventId,
      error: 'Invalid shipping provider webhook payload',
      retryable: false,
    })
    return new Response('Invalid shipping provider webhook payload', { status: 400 })
  }

  await storeVerifiedWebhookPayload({
    provider: providerWebhookName(provider),
    providerEventId: delivery.providerEventId,
    rawPayload: payload,
  })

  try {
    const result = await applyShippingProviderTrackingWebhookEvent(parsedEvent)

    if (!result.handled) {
      if (result.reason === 'MISSING_TRACKING_REFERENCE') {
        await markWebhookDeliveryFailed({
          provider: providerWebhookName(provider),
          providerEventId: delivery.providerEventId,
          error: 'Shipping provider webhook payload missing tracking reference',
          retryable: false,
        })
        return new Response('Shipping provider webhook payload missing tracking reference', { status: 422 })
      }

      if (result.reason === 'DELIVERY_NOT_FOUND') {
        await markWebhookDeliveryFailed({
          provider: providerWebhookName(provider),
          providerEventId: delivery.providerEventId,
          error: 'Shipping label record was not found for this tracking event',
          retryable: false,
        })
        return new Response('No matching shipping label record for this tracking event', { status: 202 })
      }

      if (result.reason === 'MISSING_FULFILLMENT') {
        await markWebhookDeliveryFailed({
          provider: providerWebhookName(provider),
          providerEventId: delivery.providerEventId,
          error: 'Shipping label is missing a linked fulfillment record',
          retryable: false,
        })
        return new Response('Shipping label is missing a linked fulfillment record', { status: 422 })
      }
    }

    await markWebhookDeliveryProcessed({
      provider: providerWebhookName(provider),
      providerEventId: delivery.providerEventId,
    })
    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[POST /api/webhooks/shipping-provider]', error)
    await markWebhookDeliveryFailed({
      provider: providerWebhookName(provider),
      providerEventId: delivery.providerEventId,
      error: error instanceof Error ? error.message : 'Shipping provider webhook processing failed',
      retryable: true,
    })
    return new Response('Webhook processing failed', { status: 500 })
  }
}
