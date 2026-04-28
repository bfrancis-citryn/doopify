import { integrationRegistry } from '@/server/integrations/registry'
import { prisma } from '@/lib/prisma'

import type { DoopifyEventName, DoopifyEvents, InternalEventHandler } from '@/server/events/types'

export async function emitInternalEvent<K extends DoopifyEventName>(
  event: K,
  payload: DoopifyEvents[K]
) {
  const handlers = integrationRegistry.filter(
    (handler) => handler.event === event
  ) as unknown as InternalEventHandler<K>[]

  // 1. Run static handlers
  await Promise.allSettled(
    handlers.map(async (handler) => {
      try {
        await handler.handle(payload)
      } catch (error) {
        console.error(`[emitInternalEvent] handler failed for ${event}`, error)
      }
    })
  )

  // 2. Queue outbound database webhooks
  try {
    const activeIntegrations = await prisma.integration.findMany({
      where: {
        status: 'ACTIVE',
        events: {
          some: { event }
        }
      }
    })

    if (activeIntegrations.length > 0) {
      await prisma.outboundWebhookDelivery.createMany({
        data: activeIntegrations.map((integration: any) => ({
          integrationId: integration.id,
          event,
          payload: JSON.stringify(payload),
          status: 'PENDING',
        }))
      })
    }
  } catch (error) {
    console.error(`[emitInternalEvent] Failed to queue outbound webhooks for ${event}`, error)
  }
}
