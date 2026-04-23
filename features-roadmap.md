# Doopify - Features Roadmap

> Single source of truth for what is shipped, what is next, and what is intentionally deferred.
>
> Last updated: April 22, 2026
> Strategy: current app first, commerce loop first, platform second

## Planning Surface

Active planning docs:

- `README.md` for onboarding and repo orientation
- `features-roadmap.md` for product phases and priorities
- `HARDENING.md` for cross-cutting trust, security, and operational work
- `docs/phase-3-kickoff.md` for Phase 3 execution sequencing and implementation context
- `docs/launch-rollout.md` for launch positioning and marketing rollout guidance

Historical planning docs now live in `docs/archive/`.

## Snapshot

### Shipped in the repo

- Prisma/Postgres-backed commerce schema with admin auth, sessions, catalog, customers, orders, discounts, media, and settings
- Next.js App Router API surface with protected admin routes and public storefront routes
- Hardened auth flow with session-backed JWT validation, safe cookie parsing, env validation, and login rate limiting
- Storefront catalog pages at `/`, `/shop`, and `/shop/[handle]`
- Cart-to-checkout flow at `/checkout`
- `POST /api/checkout/create` for live-priced checkout session creation
- `POST /api/webhooks/stripe` for verified webhook processing
- `GET /api/checkout/status` for success-page reconciliation
- Idempotent order creation from verified Stripe payment success
- Checkout session persistence plus paid and failed status tracking
- Internal typed event dispatcher plus a static integration registry
- First-party event consumers for logging and order confirmation email delivery
- Public storefront settings endpoint for branding-safe store data

### Explicitly deferred

- Public plugin marketplace positioning
- Runtime `fs` plus `require()` plugin loading
- Replacing the handcrafted admin with schema-generated CRUD UI
- Multi-tenant architecture before the single-store flow is stable
- Packaging full theme directories before branding tokens and reusable storefront components are settled

## Architecture Decisions

### 1. Foundation is already here

The repo already has the schema, route handlers, admin shell, storefront catalog, auth, and DB-backed services. We are not planning a new foundation phase.

### 2. Checkout creates the payment intent first

The browser starts checkout by calling `POST /api/checkout/create`. That route validates live variant data, recalculates totals, and creates the Stripe PaymentIntent plus a `CheckoutSession` row.

### 3. Verified webhooks create the order

Orders, payments, inventory decrements, and order events are created only after Stripe confirms success through `POST /api/webhooks/stripe`. Browser redirects are not the source of truth.

### 4. Integrations are explicit, not magical

The repo uses a typed internal event map plus a static server-side integration registry. That is the right intermediate step before a public plugin platform.

### 5. The admin stays handcrafted

Code generation can help later with scaffolding, but the current admin is already product-specific and useful. Replacing it now would create churn instead of value.

## Phase Plan

## Phase 1 - Finish the commerce loop

Status: shipped foundation, still expanding

### Implemented

- `/checkout` storefront route
- `POST /api/checkout/create`
- `POST /api/webhooks/stripe`
- `GET /api/checkout/status`
- live variant and inventory validation during checkout creation
- server-side pricing recomputation before payment intent creation
- checkout session persistence with paid and failed state tracking
- idempotent order creation keyed off Stripe payment intent
- inventory decrement only after verified payment success
- order confirmation email trigger after `order.paid`

### Remaining follow-up

- discount application inside checkout totals
- more complete tax logic
- configurable shipping zones and rates
- refund and return flows connected to payments and inventory

## Phase 2 - Add internal extension seams

Status: shipped initial implementation

### Implemented

- typed `DoopifyEvents` map in `src/server/events/types.ts`
- server-only dispatcher in `src/server/events/dispatcher.ts`
- static integration registry in `src/server/integrations/registry.ts`
- first-party consumers for logging and confirmation email delivery
- event emission from product, order, fulfillment, and failed checkout flows

### Next expansion

- outbound merchant webhooks
- audit log consumers
- analytics event fan-out
- integration-specific settings and secrets management

## Phase 3 - Merchant Readiness And Storefront Differentiation

Status: active now

### Current slice shipped

- collection service layer and storefront-safe collection DTOs
- summary and detail collection query split for admin and storefront reads
- admin collection APIs at `GET/POST /api/collections` and `GET/PATCH/DELETE /api/collections/[id]`
- admin collection workspace at `/admin/collections`
- storefront collection APIs at `GET /api/storefront/collections` and `GET /api/storefront/collections/[handle]`
- storefront collection routes at `/collections` and `/collections/[handle]`
- homepage and shop merchandising updated to surface collections
- admin collection mutations now patch local state instead of reloading the entire workspace
- collection revalidation is targeted to storefront pages instead of broad API refreshes

### Goals

- build collections end to end across admin and storefront
- harden checkout pricing and failure handling
- improve storefront merchandising and branding surfaces
- add automated coverage for the revenue path
- package the strongest developer-first proof points for launch and marketing

### Phase 3 product work

- collections admin CRUD with product assignment and ordering
- storefront collection listing and collection detail pages
- featured collections on the homepage and stronger merchandising surfaces on `/` and `/shop`
- reusable storefront content blocks and branding driven further by settings and tokens
- clearer failed-payment, empty-state, and out-of-stock handling around checkout

### Phase 3 kickoff notes

- the Prisma `Collection` and `CollectionProduct` models already exist, so this phase starts at the service and UI layer rather than schema discovery
- seed data already contains starter collections, which is useful for UI development and storefront demos
- `getStorefrontProducts()` already accepts `collectionHandle`, and collection-aware storefront filtering is now in place
- collection list surfaces now use summary payloads while nested product data is reserved for detail reads
- the recommended build order is collections first, then checkout pricing hardening, then storefront merchandising, then automated coverage

### Planned interfaces

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

### Acceptance checks

- a merchant can create, edit, delete, and assign products to collections
- storefront collection routes expose only storefront-safe data
- collection list surfaces avoid nested product overfetching
- checkout totals remain server-owned after discount and shipping work
- failed or exhausted inventory states fail safely and clearly during checkout creation
- build and typecheck stay green after collections and pricing changes
- the launch narrative is backed by working product proof, not roadmap-only claims

### Explicit follow-up gaps

- collection publish and unpublish semantics are still pending
- automated coverage for collections and the checkout plus webhook path is still pending

## Phase 4 - Extract platform pieces

Status: later, after the current app is stable

### Goals

- extract shared domain and service logic into packages
- introduce an SDK and lightweight CLI or template tooling
- use code generation as scaffolding for new resources, not as a replacement for the existing product and order flows
- keep the main deployable app as the proving ground until extraction is justified by real reuse

## Phase 5 - Public plugin platform

Status: deferred until after Phase 3 and Phase 4 prove out

### Requirements before we market this

- versioned plugin manifest
- stable supported event contract
- settings schema and admin surfaces for integrations
- compatibility and upgrade rules
- retry and observability story for failed handlers
- clear isolation model and ownership boundaries

## Verification And Testing

Validated in this repo on April 22, 2026:

- `npx prisma generate`
- `npx tsc --noEmit`
- `npm run build`

Next automated coverage priorities:

- checkout creation success and validation failures
- duplicate Stripe webhook delivery idempotency
- invalid webhook signature rejection
- stock exhaustion and race-condition handling
- collection assignment and storefront collection visibility

## Marketing Positioning

Near-term marketing should emphasize:

- developer-first commerce engine
- real admin plus real storefront
- Stripe-ready checkout architecture
- collections and merchandising that are powered by the same app developers extend
- typed server-side extension seams
- self-hostable app with Prisma and Postgres at the core

Near-term marketing should not emphasize:

- plugin marketplace
- schema-generated admin
- multi-tenant platform
- theme marketplace

### Phase 3 launch targets

- demoable collection-driven storefront browsing
- a clearer homepage and shop merchandising story
- safer and more complete checkout pricing behavior
- at least one reliable end-to-end proof path for launch demos
