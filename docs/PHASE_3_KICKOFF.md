# Phase 3 Kickoff - Merchant Readiness And Storefront Differentiation

> Active execution brief.
>
> Documentation refresh: April 28, 2026
> Current phase: **Phase 3**

## Phase Intent

Phase 3 turns Doopify from a working commerce foundation into a more merchant-ready, demoable, developer-first product.

The goal is not to invent a new foundation. The foundation is already present.

The goal is to strengthen:

- collection-driven merchandising
- checkout pricing correctness
- failure handling
- automated revenue-path coverage
- launch proof points

## Starting Assumptions

Already available:

- Prisma/Postgres commerce schema
- product and variant data
- store settings
- media workflows
- admin auth/session protection
- storefront product routes
- checkout creation route
- Stripe webhook route
- checkout status route
- typed internal events
- static integration registry
- collection models
- starter collection seed data
- collection-aware storefront filtering

## Current Slice Shipped

- collection service layer
- storefront-safe collection DTOs
- collection summary/detail query split
- admin collection APIs (`GET/POST /api/collections`, `GET/PATCH/DELETE /api/collections/[id]`)
- admin collection workspace at `/admin/collections`
- storefront collection APIs (`GET /api/storefront/collections`, `GET /api/storefront/collections/[handle]`)
- storefront collection routes at `/collections` and `/collections/[handle]`
- collection merchandising on homepage/shop surfaces
- targeted collection revalidation
- local admin collection mutation state updates
- collection publish/unpublish semantics with storefront filtering (unpublished collections excluded from storefront reads)
- centralized checkout pricing service in `src/server/checkout/pricing.ts`
- checkout-native code discounts through the centralized pricing service
- baseline destination-aware shipping zone rates and tax rules in centralized pricing
- settings-backed domestic/international shipping and tax rates consumed by checkout pricing
- persisted shipping-zone/rate and jurisdiction tax-rule configuration from admin CRUD APIs (`/api/settings/shipping-zones`, `/api/settings/tax-rules`) consumed by checkout pricing
- settings shipping workspace editor for shipping zones/rates and jurisdiction tax overrides
- checkout payload snapshots that persist shipping/tax resolution decisions for historical order accuracy
- discount applications and usage counts created only after verified paid order creation succeeds
- durable Stripe webhook delivery logging with provider event id, type, status, attempts, processed timestamp, last error, payload hash, verified local payload storage, and retry metadata
- local-payload replay API, retry scheduling/exhaustion, cron-compatible retry runner (`POST /api/webhook-retries/run`), support diagnostics, and admin visibility workspace at `/admin/webhooks`
- fast automated tests for: pricing, zone/rate/jurisdiction matrix behavior, discount-code math, checkout creation, duplicate payment-intent completion, invalid webhook signatures, webhook delivery logging/replay/retry/diagnostics behavior, admin collection mutations, storefront collection routes, and storefront collection DTO safety
- `DATABASE_URL_TEST`-gated real-DB integration tests for: paid checkout inventory decrement, duplicate payment-intent idempotency, competing duplicate completions, insufficient-stock consistency, paid-only/idempotent discount usage, concurrent checkout creation near stock-out, conflicting success/failure webhook delivery for one payment intent, paid-order finalization while email delivery fails, concurrent discount usage-cap enforcement, late payment-success webhook delivery against expired sessions, and stored-payload webhook retry idempotency
- real-DB runs exposed and fixed: concurrent checkout customer-creation race, failure-webhook downgrade of already-paid sessions, and discount usage-cap enforcement under concurrent paid-order finalization
- Phase 3D shipped: discount code input on checkout with server-driven inline error messages; improved checkout error categorization (inventory vs. discount vs. general); more actionable failed-payment state with "Try again" link; intentional empty states on /collections and collection detail pages
- Phase 3E (storefront first) shipped: FeaturedCollectionsGrid reusable component; homepage uses store name from settings in nav/footer; featured collections section uses the new component

## Phase 3 Build Order

### 1. Expand Revenue-Path Race Coverage

**Status: substantially shipped — expand only, do not restart.**

The initial real-DB race/idempotency suite is in place and covers: paid checkout inventory decrement, duplicate payment-intent completion, competing duplicate completions, insufficient-stock consistency, paid-only/idempotent discount usage, concurrent checkout creation near stock-out, conflicting success/failure webhook delivery, order-finalization vs. email-failure ordering, discount-cap concurrency, and late-success delivery against expired sessions.

Pricing service ownership is established in `src/server/checkout/pricing.ts`.

Remaining: expand coverage as new checkout and webhook behaviors land. Maintain the invariant that the browser never owns totals, discount logic stays server-side and idempotent after verified payment success, and checkout/webhook behavior remains idempotent.

### 2. Refine Shipping, Tax, Discount, And Replay Operations

**Status: substantially shipped — extend merchant ergonomics and UX, do not rebuild from scratch.**

Configurable shipping zones/rates and jurisdiction-aware tax rules are now persisted and consumed by checkout pricing. Admin CRUD APIs and the settings editor exist. Checkout payload snapshots persist the resolution decisions. Webhook replay, retry tooling, and admin diagnostics workspace are all in place.

Remaining:

- richer merchant ergonomics and validation in the shipping/tax settings editor
- more complete jurisdiction-aware tax strategies beyond current country/province overrides
- discount rejection/out-of-stock/stale-cart UX around checkout failures (storefront messaging, not pricing logic)
- deeper automated retry controls and richer support diagnostics on top of existing replay and delivery logs

### 3. Improve Failure Handling

Strengthen UX and state handling for:

- failed payment
- canceled payment
- inventory exhaustion
- stale cart items
- inactive products
- deleted variants
- duplicate webhook delivery
- missing checkout session
- order confirmation email failures

Acceptance:

- users see clear failure states
- operators can debug what happened
- failures do not corrupt order/payment/inventory data

### 4. Expand Automated Coverage

**Status: substantial coverage shipped — expand, do not restart.**

Fast Vitest coverage exists for checkout pricing, discount-code math, checkout creation, payload validation failures, inventory-exhaustion rejection, duplicate payment-intent completion, invalid webhook signatures, webhook delivery/replay/retry/diagnostics behavior, admin collection mutations, storefront collection routes, and storefront collection DTO safety.

Real-DB integration coverage exists for the scenarios listed under "Current Slice Shipped" above.

Remaining priorities:

- deeper checkout validation failures (stale carts, inactive/deleted variants)
- collection admin auth and mutation edge cases
- broader real-DB idempotency/race-condition behavior as new checkout/webhook behaviors land

Acceptance:

- core commerce loop can be changed with confidence
- launch demos are backed by repeatable verification

### 5. Strengthen Storefront Merchandising

**Status: partially shipped — FeaturedCollectionsGrid and homepage branding tokens shipped. Remaining: branding token CSS propagation beyond primary color, richer homepage hero content blocks driven by settings.**

Build proof that the storefront is more than a catalog dump.

Focus:

- homepage featured collections
- shop collection filters/sections
- collection detail pages
- stronger empty states
- branding tokens from settings
- reusable storefront content blocks

Acceptance:

- demo path clearly shows merchant-created collections affecting storefront browsing
- the developer-first story is visible in the product

## Phase 3 Non-Goals

Do not spend this phase on:

- plugin marketplace
- theme marketplace
- multi-tenant SaaS
- full schema-generated admin replacement
- runtime plugin loading
- broad platform extraction

## Phase Exit Criteria

Phase 3 is ready to exit when:

- collections work end-to-end
- checkout pricing supports the next discount/shipping/tax layer safely
- revenue path has automated coverage
- failure states are clearer
- launch positioning is backed by working product proof
- hardening gaps are narrowed enough for credible demos and early users
