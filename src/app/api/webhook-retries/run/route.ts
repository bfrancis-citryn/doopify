import { err, ok } from '@/lib/api'
import { env } from '@/lib/env'
import {
  claimWebhookDeliveryForRetry,
  getDueWebhookDeliveriesForRetry,
  markWebhookDeliveryFailed,
  markWebhookDeliveryProcessed,
} from '@/server/services/webhook-delivery.service'
import { parseStripeWebhookEventPayload, processStripeWebhookEvent } from '@/server/services/stripe-webhook.service'

export const runtime = 'nodejs'

function isAuthorized(req: Request) {
  const secret = env.WEBHOOK_RETRY_SECRET
  if (!secret) return false

  const authorization = req.headers.get('authorization')
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null
  const headerSecret = req.headers.get('x-webhook-retry-secret')

  return bearer === secret || headerSecret === secret
}

export async function POST(req: Request) {
  if (!env.WEBHOOK_RETRY_SECRET) {
    return err('Webhook retry secret is not configured', 503)
  }

  if (!isAuthorized(req)) {
    return err('Unauthorized', 401)
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || 10)))
  const dueDeliveries = await getDueWebhookDeliveriesForRetry(limit)
  const results = []

  for (const dueDelivery of dueDeliveries) {
    const delivery = await claimWebhookDeliveryForRetry(dueDelivery.id)
    if (!delivery) {
      results.push({
        id: dueDelivery.id,
        providerEventId: dueDelivery.providerEventId,
        status: 'SKIPPED',
        error: 'Delivery was already claimed or no longer due',
      })
      continue
    }

    if (delivery.provider !== 'stripe' || !delivery.rawPayload) {
      await markWebhookDeliveryFailed({
        provider: delivery.provider,
        providerEventId: delivery.providerEventId,
        error: 'Retry requires a Stripe delivery with a verified stored payload',
        retryable: false,
      })
      results.push({
        id: delivery.id,
        providerEventId: delivery.providerEventId,
        status: 'FAILED',
        error: 'Retry requires a Stripe delivery with a verified stored payload',
      })
      continue
    }

    const event = parseStripeWebhookEventPayload(delivery.rawPayload)
    if (!event) {
      await markWebhookDeliveryFailed({
        provider: delivery.provider,
        providerEventId: delivery.providerEventId,
        error: 'Stored webhook payload is invalid',
        retryable: false,
      })
      results.push({
        id: delivery.id,
        providerEventId: delivery.providerEventId,
        status: 'FAILED',
        error: 'Stored webhook payload is invalid',
      })
      continue
    }

    try {
      await processStripeWebhookEvent(event)
      await markWebhookDeliveryProcessed({
        provider: delivery.provider,
        providerEventId: delivery.providerEventId,
      })
      results.push({
        id: delivery.id,
        providerEventId: delivery.providerEventId,
        status: 'PROCESSED',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Webhook retry failed'
      const failedDelivery = await markWebhookDeliveryFailed({
        provider: delivery.provider,
        providerEventId: delivery.providerEventId,
        error: message,
        retryable: true,
      })
      results.push({
        id: delivery.id,
        providerEventId: delivery.providerEventId,
        status: failedDelivery.status,
        nextRetryAt: failedDelivery.nextRetryAt,
        error: message,
      })
    }
  }

  return ok({
    processed: results.length,
    results,
  })
}
