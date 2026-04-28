# Doopify Features Roadmap

> Single source of truth for what is shipped, what is next, and what is intentionally deferred.
>
> Documentation refresh: April 27, 2026
> Last repo verification recorded in active docs: April 27, 2026
> Strategy: current app first, commerce loop first, platform second

## Planning Surface

Active planning docs:

- `README.md` for onboarding and repo orientation
- `STATUS.md` for the current shipped/active/pending/deferred snapshot
- `PROJECT_INTENT.md` for product intent and architecture principles
- `features-roadmap.md` for product phases and priorities
- `HARDENING.md` for cross-cutting trust, security, and operational work
- `CONTRIBUTING.md` for implementation rules and definition of done
- `AGENTS.md` for AI-agent instructions
- `PHASE_3_KICKOFF.md` for Phase 3 execution sequencing and implementation context
- `LAUNCH_ROLLOUT.md` for launch positioning and marketing rollout guidance

Historical planning docs are intentionally omitted from this active handoff pack. Do not use old `CLAUDE.md` or legacy `skill.md` content as current repo status.

## Snapshot

### Shipped In The Repo

- Prisma/Postgres-backed commerce schema with admin auth, sessions, catalog, customers, orders, discounts, media, settings, payments, fulfillments, refunds, and returns
- Next.js App Router API surface with protected admin routes and public storefront routes
- Hardened auth flow with session-backed JWT validation, safe cookie parsing, env validation, and login rate limiting
- Storefront catalog pages at `/`, `/shop`, and `/shop/[handle]`
- Cart-to-checkout flow at `/checkout`
- `POST /api/checkout/create` for live-priced checkout session creation
- `POST /api/webhooks/stripe` for verified webhook processing
- `GET /api/checkout/status` for success-page reconciliation
- Idempotent order creation from verified Stripe payment success
- Checkout session persistence plus paid and failed status tracking
- Inventory decrement only after verified payment success
- Checkout-native code discounts through the centralized pricing service
- Baseline destination-aware shipping zone rates and tax rules in centralized pricing
- Settings-backed domestic/international shipping and tax rates flowing through centralized pricing
- Configurable shipping zones and zone rates through private settings APIs
- Configurable jurisdiction-aware tax overrides through private settings APIs
- Checkout pricing snapshots that persist shipping/tax resolution decisions into checkout payloads
- Discount applications and usage counts created only after verified paid order creation succeeds
- Durable Stripe webhook delivery logging with provider event id, type, status, attempts, processed timestamp, last error, payload hash, verified stored payloads, and retry metadata
- Admin/API webhook replay, retry diagnostics, and cron-compatible retry tooling on top of delivery logs (`/api/webhook-deliveries`, `/api/webhook-deliveries/[id]`, `/api/webhook-deliveries/[id]/replay`, and `/api/webhook-retries/run`)
- Internal typed event dispatcher plus a static integration registry
- First-party event consumers for logging and order confirmation email delivery
- Public storefront settings endpoint for branding-safe store data
- Collection service layer and storefront-safe collection DTOs
- Admin collection workspace at `/admin/collections`
- Storefront collection browsing at `/collections` and `/collections/[handle]`
- Collection publish/unpublish semantics with storefront filtering
- Centralized checkout pricing service for subtotal, shipping, tax, discount, and total calculation
- Vitest fast test harness covering pricing, checkout-native discount math, checkout creation, checkout payload validation failures, checkout inventory-exhaustion rejection, duplicate payment-intent completion, invalid webhook signatures, webhook retry/diagnostics behavior, and storefront collection DTO safety
- `npm run test:integration` executes successfully when `DATABASE_URL_TEST` points at a disposable Postgres database or schema
- `DATABASE_URL_TEST`-gated integration specs for paid checkout inventory decrement, duplicate payment-intent idempotency, competing duplicate completions, insufficient-stock consistency, paid-only/idempotent discount application usage, concurrent checkout creation near stock-out, conflicting success/failure webhook delivery for one payment intent, paid-order finalization while email delivery fails, concurrent discount usage-cap enforcement, late payment-success webhook delivery against expired sessions, and stored-payload webhook retry idempotency

### Explicitly Deferred

- Public plugin marketplace positioning
- Runtime `fs` plus `require()` plugin loading
- Replacing the handcrafted admin with schema-generated CRUD UI
- Multi-tenant architecture before the single-store flow is stable
- Packaging full theme directories before branding tokens and reusable storefront components are settled

## Architecture Decisions

### 1. Foundation Is Already Here

The repo already has the schema, route handlers, admin shell, storefront catalog, auth, checkout entry point, Stripe webhook path, collections, and DB-backed services.

Do not plan another foundation phase unless source inspection proves the implementation is broken.

### 2. Checkout Creates The Payment Intent First

The browser starts checkout by calling `POST /api/checkout/create`.

That route should:

- validate live variant data
- validate inventory
- recompute totals server-side
- create the Stripe PaymentIntent
- persist a `CheckoutSession`

### 3. Verified Webhooks Create The Order

Orders, payments, inventory decrements, and order events are created only after Stripe confirms success through `POST /api/webhooks/stripe`.

Browser redirects are not the source of truth.

### 4. Integrations Are Explicit, Not Magical

The repo uses a typed internal event map plus a static server-side integration registry.

That is the right intermediate step before a public plugin platform.

### 5. The Admin Stays Handcrafted

Code generation can help later with scaffolding, but the current admin is already product-specific and useful. Replacing it now would create churn instead of value.

## Phase Plan

## Phase 1 - Finish The Commerce Loop

Status: shipped foundation, still expanding

### Implemented

- `/checkout` storefront route
- `POST /api/checkout/create`
- `POST /api/webhooks/stripe`
- `GET /api/checkout/status`
- live variant and inventory validation during checkout creation
- server-side pricing recomputation before payment intent creation
- centralized checkout pricing service in `src/server/checkout/pricing.ts`
- checkout session persistence with paid and failed state tracking
- idempotent order creation keyed off Stripe payment intent
- inventory decrement only after verified payment success
- order confirmation email trigger after `order.paid`

### Remaining Follow-Up

- more complete tax logic
- configurable shipping zones and rates
- discount-code checkout UX polish and failure messaging
- refund and return flows connected to payments and inventory

## Phase 2 - Add Internal Extension Seams

Status: shipped initial implementation

### Implemented

- typed `DoopifyEvents` map in `src/server/events/types.ts`
- server-only dispatcher in `src/server/events/dispatcher.ts`
- static integration registry in `src/server/integrations/registry.ts`
- first-party consumers for logging and confirmation email delivery
- event emission from product, order, fulfillment, and failed-checkout flows

### Next Expansion

- outbound merchant webhooks
- audit log consumers
- analytics event fan-out
- integration-specific settings and secrets management

## Phase 3 - Merchant Readiness And Storefront Differentiation

Status: shipped — all slices 3A–3E complete as of April 27, 2026

### Current Slice Shipped

- collection service layer and storefront-safe collection DTOs
- summary and detail collection query split for admin and storefront reads
- admin collection APIs at `GET/POST /api/collections` and `GET/PATCH/DELETE /api/collections/[id]`
- admin collection workspace at `/admin/collections`
- storefront collection APIs at `GET /api/storefront/collections` and `GET /api/storefront/collections/[handle]`
- storefront collection routes at `/collections` and `/collections/[handle]`
- homepage and shop merchandising updated to surface collections
- admin collection mutations now patch local state instead of reloading the entire workspace
- collection revalidation is targeted to storefront pages instead of broad API refreshes
- collection publish/unpublish semantics with unpublished collections hidden from storefront reads
- checkout-native code discounts with server-owned validation and persisted paid-order applications
- baseline destination-aware shipping/tax pricing rules in the server-owned checkout pricing authority
- settings-backed shipping/tax configuration consumed by checkout pricing
- persisted shipping-zone/rate and jurisdiction tax-rule configuration consumed by checkout pricing
- checkout payload pricing snapshots that persist shipping/tax resolution decisions
- private admin CRUD APIs for shipping zones, zone rates, and tax rules
- settings shipping workspace editor for shipping zones/rates and jurisdiction tax overrides
- durable webhook delivery logging in `POST /api/webhooks/stripe` with hashed payload tracking and delivery status transitions
- verified local webhook payload storage for replay/retry after successful signature and payload validation
- local-payload replay API, retry scheduling/exhaustion, support diagnostics, cron-compatible retry runner, and admin visibility workspace for webhook deliveries (`/admin/webhooks`)
- fast automated coverage for checkout pricing, zone/rate/jurisdiction matrix behavior, checkout discount codes, checkout creation, duplicate payment-intent completion, invalid webhook signatures, webhook delivery logging/replay/retry/diagnostics behavior, admin collection mutations, storefront collection routes, and storefront-safe collection DTOs
- executed real-DB checkout/inventory integration coverage for paid checkout, duplicate payment-intent idempotency, competing duplicate completions, insufficient stock, paid-only/idempotent discount usage, stored-payload webhook retry idempotency, and broader webhook/race scenarios
- real-DB checkout runs exposed and fixed concurrent customer creation, failure-webhook downgrade, and discount-cap finalization race conditions

### Goals

- build collections end to end across admin and storefront
- harden checkout pricing and failure handling
- improve storefront merchandising and branding surfaces
- add automated coverage for the revenue path
- package the strongest developer-first proof points for launch and marketing

### Phase 3 Product Work

- collections admin CRUD with product assignment and ordering
- storefront collection listing and collection detail pages
- featured collections on the homepage and stronger merchandising surfaces on `/` and `/shop`
- reusable storefront content blocks and branding driven further by settings and tokens
- clearer failed-payment, empty-state, and out-of-stock handling around checkout

### Phase 3 Kickoff Notes

- the Prisma `Collection` and `CollectionProduct` models already exist, so this phase starts at the service and UI layer rather than schema discovery
- seed data already contains starter collections, which is useful for UI development and storefront demos
- `getStorefrontProducts()` already accepts `collectionHandle`, and collection-aware storefront filtering is now in place
- collection list surfaces now use summary payloads while nested product data is reserved for detail reads
- the recommended build order is now storefront merchandising polish, deeper checkout-failure UX contracts, audit logging, and shared rate-limit hardening

### Planned Interfaces

- `GET /api/collections`
- `POST /api/collections`
- `PATCH /api/collections/[id]`
- `DELETE /api/collections/[id]`
- `GET /api/storefront/collections`
- `GET /api/storefront/collections/[handle]`
- `/collections`
- `/collections/[handle]`
- collection DTOs for storefront-safe reads
- service-layer collection assignment and ordering logic
- checkout pricing interfaces that support discounts, shipping, and tax evolution without moving logic client-side

### Acceptance Checks

- a merchant can create, edit, delete, and assign products to collections
- storefront collection routes expose only storefront-safe data
- collection list surfaces avoid nested product overfetching
- checkout totals remain server-owned after discount and shipping work
- failed or exhausted inventory states fail safely and clearly during checkout creation
- build and typecheck stay green after collections and pricing changes
- the launch narrative is backed by working product proof, not roadmap-only claims

### Explicit Follow-Up Gaps

- automated coverage should expand to deeper checkout validation failures, admin-only collection mutations, and broader real-DB idempotency/race-condition behavior

## Phase 4 - Merchant Lifecycle And Outbound Integrations

Status: active now

### Goals

- refund flow connected to Stripe, payment records, order state, and inventory restocking
- return flow with a state machine connected to refunds
- outbound merchant webhooks: subscriptions, signing, retry with backoff, dead-letter visibility — built on the typed event dispatcher and static integration registry
- per-integration settings and secrets management, encrypted at rest
- transactional email observability: delivery status, bounce/complaint handling, resend tooling
- analytics event fan-out through the existing dispatcher

### Acceptance Checks

- an admin can issue a partial or full refund and the order, payment, and inventory are consistent afterward
- a return moves through its state machine and triggers a refund correctly
- outbound webhook deliveries are signed, retried with backoff, and visible in the admin
- integration secrets never appear unencrypted at rest
- a bounced order confirmation email surfaces in the admin and can be resent without duplicating side effects

## Phase 5 - Platform Extraction

Status: deferred until after Phase 4 is stable

### Goals

- extract shared domain and service logic into versioned internal packages
- introduce a thin SDK that lets external consumers call commerce services
- add a scaffolder CLI or template tool for new resources (route + service + Prisma fragment + DTO + test)
- keep the main app as the proving ground until extraction is justified by real reuse

## Phase 6 - Public Plugin Platform

Status: deferred until after Phase 5 proves out

### Requirements Before We Market This

- versioned plugin manifest
- stable supported event contract
- settings schema and admin surfaces for integrations
- compatibility and upgrade rules
- retry and observability story for failed handlers
- clear isolation model and ownership boundaries

## Verification And Testing

Validated in this repo on April 27, 2026 (Phase 3 complete, Phase 4 kickoff):

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

`npm run test:integration` should be run with a disposable Postgres database/schema before making release claims about real-DB behavior.

Next automated coverage priorities:

- refund and return correctness against payments and inventory
- outbound webhook retry/idempotency
- integration secret encryption at rest
- email delivery status transitions

## Marketing Positioning

Near-term marketing should emphasize:

- developer-first commerce engine
- self-hostable app foundation
- real admin plus real storefront
- Stripe-backed checkout architecture
- collections and merchandising powered by the same app developers extend
- typed server-side extension seams
- Prisma and Postgres at the core

Near-term marketing should not emphasize:

- plugin marketplace
- schema-generated admin
- multi-tenant platform
- theme marketplace

### Phase 3 Launch Targets

- demoable collection-driven storefront browsing
- a clearer homepage and shop merchandising story
- safer and more complete checkout pricing behavior
- at least one reliable end-to-end proof path for launch demos
