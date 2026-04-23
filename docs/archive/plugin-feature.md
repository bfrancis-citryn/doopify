# Doopify Event System And Integration Strategy

> Archived on April 22, 2026.
> Historical reference only. The active strategy now lives in `features-roadmap.md`.

Purpose

This document describes the event and integration architecture that matches the current repo.
It replaces the older plugin-first draft with a safer current-app-first approach.

## What Exists Today

### Typed internal event map

The repo already defines a typed event contract in `src/server/events/types.ts`.

Current events:

```ts
type DoopifyEvents = {
  'order.created': {
    orderId: string
    orderNumber: number
    email?: string | null
    total: number
    currency: string
  }
  'order.paid': {
    orderId: string
    orderNumber: number
    email?: string | null
    total: number
    currency: string
    items: Array<{
      title: string
      variantTitle?: string | null
      quantity: number
      price: number
    }>
    shippingAddress?: {
      firstName?: string | null
      lastName?: string | null
      address1?: string | null
      city?: string | null
      province?: string | null
      postalCode?: string | null
      country?: string | null
    }
  }
  'product.created': {
    productId: string
    handle: string
    title: string
    status: string
  }
  'product.updated': {
    productId: string
    handle: string
    title: string
    status: string
  }
  'fulfillment.created': {
    fulfillmentId: string
    orderId: string
    trackingNumber?: string | null
  }
  'checkout.failed': {
    paymentIntentId: string
    email?: string | null
    reason?: string | null
  }
}
```

### Server-side dispatcher

`emitInternalEvent()` fans events out to registered handlers and isolates handler failures so they do not break already-committed order or product flows.

### Static integration registry

The repo uses `src/server/integrations/registry.ts` as an explicit registry of handlers.
This is the correct intermediate step before a public plugin platform.

### First-party consumers

Current registry handlers:

- log key commerce events
- send order confirmation email after `order.paid`

## Stripe Architecture In This Repo

The old plugin draft created Stripe payment intents from `order.created`. That is not how this repo should work.

### Correct flow

1. The storefront calls `POST /api/checkout/create`
2. The server validates live variant data and recalculates totals
3. The server creates a Stripe PaymentIntent and stores a `CheckoutSession`
4. The customer confirms payment in the browser
5. Stripe calls `POST /api/webhooks/stripe`
6. The webhook verifies the signature and finalizes the order on `payment_intent.succeeded`
7. The order flow emits `order.created` and `order.paid`
8. First-party integrations react to those events

### Why this matters

- pricing and inventory are checked on the server before payment
- order creation is tied to verified payment success
- duplicate webhook deliveries can be handled idempotently
- integrations stay downstream from core commerce truth

## Design Rules

- core services emit events after persistence or webhook reconciliation
- integrations must not become the source of truth for order creation
- core app code must not depend on optional plugins
- event names and payloads should change slowly and deliberately
- external IDs such as Stripe payment intent IDs should always be stored on core records

## What We Are Not Doing Yet

- no runtime `fs` plus `require()` plugin loader
- no public `/plugins/*` contract yet
- no marketing claim that third-party plugins are production-ready
- no Stripe webhook route under `/app/api/stripe/webhook/route.ts`
- no PaymentIntent creation from `order.created`

## Near-Term Expansion

The next practical integration work should be:

- outbound merchant webhooks
- analytics consumers
- audit-log consumers
- integration settings and secrets management
- retry and replay support for external deliveries

## Later Public Plugin Platform

Once the current app and first-party integrations are stable, the public platform can grow from the current event foundation.

That later phase should include:

- versioned plugin manifest
- supported event list and compatibility policy
- plugin settings schema
- observability and retries
- installation and upgrade flow
- SDK or helper package for plugin authors

## Final Principle

Core emits trusted events. First-party integrations react now. Public plugins come later.
