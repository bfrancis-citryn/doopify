import { integrationRegistry } from '@/server/integrations/registry'
import { queueOutboundWebhooks } from '@/server/services/outbound-webhook.service'

import type { DoopifyEventName, DoopifyEvents, InternalEventHandler } from '@/server/events/types'

const OUTBOUND_WEBHOOK_EVENTS = new Set<DoopifyEventName>([
  'order.created',
  'order.paid',
  'product.created',
  'product.updated',
  'fulfillment.created',
  'checkout.failed',
  'order.refunded',
  'order.return_requested',
  'order.return_updated',
])

export async function emitInternalEvent<K extends DoopifyEventName>(
  event: K,
  payload: DoopifyEvents[K]
) {
  const handlers = integrationRegistry.filter(
    (handler) => handler.event === event
  ) as unknown as InternalEventHandler<K>[]

  await Promise.allSettled(
    handlers.map(async (handler) => {
      try {
        await handler.handle(payload)
      } catch (error) {
        console.error(`[emitInternalEvent] handler failed for ${event}`, error)
      }
    })
  )

  if (!OUTBOUND_WEBHOOK_EVENTS.has(event)) {
    return
  }

  try {
    await queueOutboundWebhooks(event, payload)
  } catch (error) {
    console.error(`[emitInternalEvent] Failed to queue outbound webhooks for ${event}`, error)
  }
}
