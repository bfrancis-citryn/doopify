import { integrationRegistry } from '@/server/integrations/registry'

import type { DoopifyEventName, DoopifyEvents, InternalEventHandler } from '@/server/events/types'

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
}
