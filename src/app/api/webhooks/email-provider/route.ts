import { Webhook } from 'svix'

import { env } from '@/lib/env'
import {
  markWebhookDeliveryFailed,
  markWebhookDeliveryProcessed,
  recordWebhookDeliveryAttempt,
  storeVerifiedWebhookPayload,
} from '@/server/services/webhook-delivery.service'
import {
  applyEmailProviderWebhookEvent,
  parseEmailProviderWebhookPayload,
} from '@/server/services/email-delivery.service'

export const runtime = 'nodejs'

function getVerificationHeaders(req: Request) {
  return {
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
  }
}

function verifyEmailProviderWebhookPayload(payload: string, req: Request) {
  const headers = getVerificationHeaders(req)
  if (!headers.id || !headers.timestamp || !headers.signature) {
    throw new Error('Missing webhook signature headers')
  }

  if (!env.RESEND_WEBHOOK_SECRET) {
    throw new Error('RESEND_WEBHOOK_SECRET is not configured')
  }

  const webhook = new Webhook(env.RESEND_WEBHOOK_SECRET)
  webhook.verify(payload, {
    id: headers.id,
    timestamp: headers.timestamp,
    signature: headers.signature,
  })
}

export async function POST(req: Request) {
  const payload = await req.text()
  const parsedEvent = parseEmailProviderWebhookPayload(payload)
  const providerEventId = req.headers.get('svix-id') || undefined
  const delivery = await recordWebhookDeliveryAttempt({
    provider: 'resend',
    providerEventId,
    eventType: parsedEvent?.type,
    payload,
  })

  try {
    verifyEmailProviderWebhookPayload(payload, req)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook signature verification failed'
    await markWebhookDeliveryFailed({
      provider: 'resend',
      providerEventId: delivery.providerEventId,
      status: 'SIGNATURE_FAILED',
      error: message,
    })
    return new Response(message, { status: 400 })
  }

  if (!parsedEvent) {
    await markWebhookDeliveryFailed({
      provider: 'resend',
      providerEventId: delivery.providerEventId,
      error: 'Invalid email provider webhook payload',
      retryable: false,
    })
    return new Response('Invalid email provider webhook payload', { status: 400 })
  }

  await storeVerifiedWebhookPayload({
    provider: 'resend',
    providerEventId: delivery.providerEventId,
    rawPayload: payload,
  })

  try {
    await applyEmailProviderWebhookEvent(parsedEvent)
    await markWebhookDeliveryProcessed({
      provider: 'resend',
      providerEventId: delivery.providerEventId,
    })
    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[POST /api/webhooks/email-provider]', error)
    await markWebhookDeliveryFailed({
      provider: 'resend',
      providerEventId: delivery.providerEventId,
      error: error instanceof Error ? error.message : 'Email provider webhook processing failed',
      retryable: true,
    })
    return new Response('Webhook processing failed', { status: 500 })
  }
}
