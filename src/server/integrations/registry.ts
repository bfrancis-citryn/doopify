import type { AnyInternalEventHandler, DoopifyEvents, InternalEventHandler } from '@/server/events/types'
import { sendOrderConfirmationEmail } from '@/server/services/email.service'

function logEvent(name: string, payload: unknown) {
  console.info(`[event:${name}]`, payload)
}

function defineHandler<K extends keyof DoopifyEvents>(handler: InternalEventHandler<K>) {
  return handler
}

export const integrationRegistry = [
  defineHandler({
    event: 'order.created',
    handle: async (payload: DoopifyEvents['order.created']) => {
      logEvent('order.created', payload)
    },
  }),
  defineHandler({
    event: 'order.paid',
    handle: async (payload: DoopifyEvents['order.paid']) => {
      logEvent('order.paid', payload)
      if (!payload.email) {
        return
      }

      await sendOrderConfirmationEmail({
        orderNumber: payload.orderNumber,
        email: payload.email,
        currency: payload.currency,
        total: payload.total,
        items: payload.items,
        shippingAddress: payload.shippingAddress ?? null,
      })
    },
  }),
  defineHandler({
    event: 'product.created',
    handle: async (payload: DoopifyEvents['product.created']) => {
      logEvent('product.created', payload)
    },
  }),
  defineHandler({
    event: 'product.updated',
    handle: async (payload: DoopifyEvents['product.updated']) => {
      logEvent('product.updated', payload)
    },
  }),
  defineHandler({
    event: 'fulfillment.created',
    handle: async (payload: DoopifyEvents['fulfillment.created']) => {
      logEvent('fulfillment.created', payload)
    },
  }),
  defineHandler({
    event: 'checkout.failed',
    handle: async (payload: DoopifyEvents['checkout.failed']) => {
      logEvent('checkout.failed', payload)
    },
  }),
] satisfies AnyInternalEventHandler[]
