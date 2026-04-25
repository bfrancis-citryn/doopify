# Doopify Documentation Refresh - Flat Active Pack

This consolidated file mirrors the flat Markdown handoff pack. It intentionally excludes `docs/` and `archive/` folders so every active file can live at the repo root.


---


# File: `README.md`

# Doopify

> **Developer-first, self-hostable commerce engine.**
>
> Doopify is a real commerce application built with Next.js 16, Prisma, PostgreSQL, Stripe-backed checkout architecture, and typed server-side extension seams. It ships a protected admin, a storefront, database-backed services, and a clear path from single-store reliability to later platform extraction.

## Current Status

Documentation refresh: April 25, 2026  
Last repo verification recorded in active docs: April 22, 2026

Doopify is no longer a prototype or only a UI shell. It has a working admin, storefront, checkout entry point, Stripe webhook path, Prisma/Postgres-backed commerce data, and typed internal event seams.

### Working now

- Protected admin auth with session-backed JWT validation
- Safe cookie parsing and required environment validation
- Login rate limiting by IP plus email
- DB-backed products, variants, media, customers, discounts, settings, analytics, orders, payments, fulfillments, refunds, returns, and sessions
- Storefront catalog routes at `/`, `/shop`, and `/shop/[handle]`
- Collection browsing at `/collections` and `/collections/[handle]`
- Cart-to-checkout flow at `/checkout`
- `POST /api/checkout/create` for live-priced checkout session creation
- `POST /api/webhooks/stripe` for verified Stripe webhook processing
- `GET /api/checkout/status` for success-page reconciliation
- Checkout session persistence with paid and failed status tracking
- Idempotent paid-order creation keyed from verified Stripe payment success
- Inventory decrement only after verified payment success
- Admin collection management at `/admin/collections`
- Storefront-safe collection DTOs with summary/detail query separation
- Public storefront settings endpoint for branding-safe store data
- Typed internal event dispatcher
- Static server-side integration registry
- First-party event consumers for logging and order confirmation email delivery

### Active phase

The current active product phase is **Phase 3: Merchant Readiness And Storefront Differentiation**.

Current priorities:

1. Automated coverage for the checkout, webhook, inventory, and collection paths
2. Checkout pricing hardening for discounts, shipping, and tax handling
3. Collection publish/unpublish semantics
4. Stronger storefront merchandising and branding surfaces
5. Operational hardening: shared rate limits, webhook replay, audit logs, and production Postgres SSL review
6. Launch proof points for the developer-first, self-hostable commerce story

### Known follow-up gaps

- Discount application inside checkout totals
- More complete tax logic
- Configurable shipping zones and rates
- Refund and return flows connected to payments and inventory
- Automated coverage for duplicate Stripe webhook delivery, invalid signatures, inventory exhaustion, and collection auth/DTO behavior
- Shared rate-limiting store before multi-instance deployment
- Webhook delivery logs, retries, and replay tooling
- Audit logging around settings changes, payment events, and fulfillment operations
- Moving media binary storage out of Postgres into object storage/CDN later

## Active Documentation Map

Start here when returning to the repo:

1. [`STATUS.md`](./STATUS.md) - current shipped, active, pending, and deferred status
2. [`PROJECT_INTENT.md`](./PROJECT_INTENT.md) - product intent, architecture principles, and non-goals
3. [`features-roadmap.md`](./features-roadmap.md) - product phases and build sequencing
4. [`HARDENING.md`](./HARDENING.md) - security, correctness, and operational readiness
5. [`CONTRIBUTING.md`](./CONTRIBUTING.md) - development rules and definition of done
6. [`AGENTS.md`](./AGENTS.md) - instructions for AI coding agents and future maintainers
7. [`PHASE_3_KICKOFF.md`](./PHASE_3_KICKOFF.md) - active Phase 3 execution brief
8. [`LAUNCH_ROLLOUT.md`](./LAUNCH_ROLLOUT.md) - launch positioning and claim discipline

Do not keep stale root-level planning files that contradict `STATUS.md`, `features-roadmap.md`, or `HARDENING.md`.

## Key Routes

### Admin pages

- `/orders`
- `/admin/collections`
- `/draft-orders`
- `/products`
- `/media`
- `/customers`
- `/discounts`
- `/analytics`
- `/settings`

### Storefront pages

- `/`
- `/shop`
- `/shop/[handle]`
- `/collections`
- `/collections/[handle]`
- `/checkout`
- `/checkout/success`

### Core API routes

- `/api/auth/*`
- `/api/products`
- `/api/collections`
- `/api/orders`
- `/api/customers`
- `/api/discounts`
- `/api/settings`
- `/api/analytics`
- `/api/media`
- `/api/storefront/products`
- `/api/storefront/collections`
- `/api/storefront/settings`
- `/api/checkout/create`
- `/api/checkout/status`
- `/api/webhooks/stripe`

## Architecture Principles

- Prisma is the source of truth for the commerce domain.
- PostgreSQL is the primary persistence layer.
- Route handlers validate, authorize, and orchestrate.
- Service modules own business logic.
- UI components never bypass route/service boundaries to mutate data.
- Checkout totals stay server-owned.
- Browser redirects are not payment truth.
- Verified Stripe webhooks finalize paid orders.
- Internal integrations use typed server-side events before any public plugin platform exists.
- The admin remains handcrafted until real reuse justifies scaffolding or generation.
- Platform extraction comes after the single-store commerce loop is reliable.

## Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Common database commands:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run db:seed:bootstrap
```

Production build:

```bash
npm run build
```

Recommended merge gate once tests are present:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

## Database And Environment

This repo expects PostgreSQL through Prisma.

- Put `DATABASE_URL` and `DIRECT_URL` in `.env`
- Put app/runtime secrets in `.env.local`
- Production Postgres SSL should be reviewed and normalized so environments explicitly use `sslmode=verify-full`

## Notes On Media

Media is currently stored in Postgres through `MediaAsset.data` and served by `/api/media/[assetId]`.

That is acceptable for local development and current admin workflows. Moving to object storage or a CDN-backed image service remains a later production-readiness task.

## Do Not Reintroduce

Do not re-add `CLAUDE.md` as a separate roadmap. It was removed because it created status drift.

Use `AGENTS.md` for AI-agent instructions and `STATUS.md` plus `features-roadmap.md` for repo truth.


---


# File: `STATUS.md`

# Doopify Status

> Canonical status snapshot for developers, maintainers, and AI agents.
>
> Documentation refresh: April 25, 2026  
> Last repo verification recorded in active docs: April 22, 2026  
> Current active phase: **Phase 3 - Merchant Readiness And Storefront Differentiation**

## Why This File Exists

This file prevents context loss when someone returns to the repo later.

Doopify used to have multiple planning files with conflicting status. The active state is now consolidated here, while product sequencing lives in `features-roadmap.md` and security/operational work lives in `HARDENING.md`.

## Product Identity

Doopify is a developer-first, self-hostable commerce engine with:

- a real protected admin
- a real storefront
- Prisma as the source of truth for the commerce model
- PostgreSQL as persistence
- Stripe-backed checkout architecture
- verified webhook order finalization
- typed server-side extension seams
- a static integration registry before any public plugin platform

## Shipped In The Repo

### Foundation

- Prisma/Postgres-backed commerce schema
- Products, variants, media, customers, orders, discounts, settings, sessions, payments, fulfillments, refunds, and returns
- Next.js App Router route surface
- Protected admin application
- Public storefront routes
- DB-backed services for core admin/catalog workflows

### Auth And Session Integrity

- Required environment validation in `src/lib/env.ts`
- JWT validation backed by a real `Session` record
- Logout and session revocation are meaningful
- Login rate limiting by IP plus email
- Shared safe cookie parsing in `src/lib/cookies.ts`

### Route Protection

- Private admin and private API protection through `src/proxy.ts`
- Boundary-safe public-prefix matching
- The repo intentionally uses the active Next.js 16 proxy hook instead of keeping both `proxy.ts` and `middleware.ts`

### Storefront

- `/`
- `/shop`
- `/shop/[handle]`
- `/collections`
- `/collections/[handle]`
- Public storefront product reads
- Public storefront collection reads
- Public storefront settings endpoint for branding-safe store data
- Homepage and shop merchandising surfaces that can expose collections

### Admin

- Protected admin auth flow
- Product editor persistence and product-to-storefront sync
- Standalone media library with upload, alt text editing, deletion, and linked-product visibility
- DB-backed admin APIs for products, orders, customers, discounts, analytics, settings, media, and collections
- Admin collection workspace at `/admin/collections`
- Collection service layer
- Collection assignment and ordering support
- Local-state collection mutation updates instead of full workspace reloads

### Checkout And Payments

- `/checkout`
- `POST /api/checkout/create`
- `POST /api/webhooks/stripe`
- `GET /api/checkout/status`
- Checkout validates live variant data
- Checkout recalculates totals server-side
- Checkout validates inventory before creating payment intent
- Checkout session persistence
- Paid and failed status tracking
- Orders, payments, inventory decrements, and order events are created only after verified Stripe payment success
- Duplicate webhook deliveries are handled idempotently through the payment-intent path
- Checkout failure state is surfaced on the success-page polling flow

### Internal Extensibility

- Typed `DoopifyEvents` map in `src/server/events/types.ts`
- Server-only dispatcher in `src/server/events/dispatcher.ts`
- Static integration registry in `src/server/integrations/registry.ts`
- First-party consumers for logging and order confirmation email delivery
- Event emission from product, order, fulfillment, and failed-checkout flows

## Active Phase 3 Scope

### Current Phase 3 Status

Phase 3 is active now. The current slice is partially shipped and should be expanded, not restarted.

### Phase 3 Current Slice Shipped

- Collection service layer and storefront-safe collection DTOs
- Summary and detail collection query split for admin and storefront reads
- Admin collection APIs:
  - `GET /api/collections`
  - `POST /api/collections`
  - `GET /api/collections/[id]`
  - `PATCH /api/collections/[id]`
  - `DELETE /api/collections/[id]`
- Admin collection workspace at `/admin/collections`
- Storefront collection APIs:
  - `GET /api/storefront/collections`
  - `GET /api/storefront/collections/[handle]`
- Storefront collection routes:
  - `/collections`
  - `/collections/[handle]`
- Homepage and shop merchandising updated to surface collections
- Admin collection mutations patch local state instead of reloading the whole workspace
- Collection revalidation is targeted to storefront pages instead of broad API refreshes

### Phase 3 Current Priorities

1. Automated coverage for the revenue path
2. Checkout pricing hardening for discounts, shipping, and tax
3. Collection publish/unpublish semantics
4. Storefront merchandising and branding improvements
5. Launch proof points for the developer-first story

### Phase 3 Acceptance Checks

- A merchant can create, edit, delete, and assign products to collections
- Storefront collection routes expose only storefront-safe data
- Collection list surfaces avoid nested product overfetching
- Checkout totals remain server-owned after discount and shipping work
- Failed or exhausted inventory states fail safely and clearly during checkout creation
- Build and typecheck stay green after collections and pricing changes
- The launch narrative is backed by working product proof, not roadmap-only claims

## Remaining Product Work

### Highest Priority

- Automated tests for checkout creation success and validation failures
- Automated tests for duplicate Stripe webhook delivery idempotency
- Automated tests for invalid webhook signature rejection
- Automated tests for stock exhaustion and race-condition handling
- Automated tests for collection assignment and storefront collection visibility
- Discount application inside checkout totals
- Configurable shipping zones and rates
- More complete tax logic
- Collection publish/unpublish semantics

### Medium Priority

- Refund and return flows connected to payments and inventory
- Outbound merchant webhooks
- Audit log consumers
- Analytics event fan-out
- Integration-specific settings and secrets management
- Transactional email template and delivery observability
- Stronger failed-payment, empty-state, and out-of-stock UI

### Later

- Extract shared domain and service logic into packages
- Introduce an SDK and lightweight CLI/template tooling
- Use code generation as scaffolding for new resources only
- Public plugin platform
- Plugin marketplace
- Full theme directory packaging
- Multi-tenant architecture

## Remaining Hardening Work

### High Priority

- Add automated tests for checkout totals, webhook idempotency, invalid signatures, and inventory exhaustion
- Keep pricing authority on the server as discounts, shipping logic, and tax handling evolve
- Add automated checks for collection CRUD, storefront-safe collection DTO exposure, and collection mutation performance regressions
- Move rate limiting from in-memory process state to a shared store before multi-instance deployment
- Review and normalize production Postgres SSL settings so environments explicitly use `sslmode=verify-full`

### Medium Priority

- Extract remaining business logic that still lives in route handlers, especially analytics, discounts, and media administration paths
- Keep collection assignment and merchandising APIs admin-only
- Keep storefront collection reads public and read-only
- Add outbound webhook delivery logs, retries, and replay tooling
- Add stronger audit logging around settings changes, payment events, and fulfillment operations

### Later

- Move media binary storage off Postgres and into object storage
- Add customer-auth hardening when the customer account system exists
- Add broader CSP and response-header hardening once external integrations and asset origins are finalized

## Explicit Non-Goals Right Now

Do not market or build around these yet:

- Public plugin marketplace positioning
- Runtime `fs` plus `require()` plugin loading
- Replacing the handcrafted admin with schema-generated CRUD UI
- Multi-tenant architecture before the single-store flow is stable
- Packaging full theme directories before branding tokens and reusable storefront components are settled

## Explicitly Rejected Technical Directions

- Creating Stripe PaymentIntents from `order.created`
- Exposing Stripe under `/app/api/stripe/webhook/route.ts`
- Adding a root-level runtime filesystem plugin loader
- Replacing the current admin with fully generated CRUD screens
- Treating browser redirects as payment truth

## Verification History

Validated in this repo on April 22, 2026:

```bash
npx prisma generate
npx tsc --noEmit
npm run build
```

When returning to the repo, run the current verification commands again before making release claims.

## Source Of Truth Rules

- `STATUS.md` tells you what is true now.
- `features-roadmap.md` tells you what to build next.
- `HARDENING.md` tells you what must become safer before production growth.
- `PROJECT_INTENT.md` tells you what Doopify is trying to become.
- `AGENTS.md` tells AI agents how to operate.
- Do not create another root-level roadmap that can drift from these files.


---


# File: `PROJECT_INTENT.md`

# Doopify Project Intent

> Doopify is a developer-first, self-hostable commerce engine with a real admin, real storefront, Prisma/Postgres as the source of truth, Stripe-backed checkout architecture, and typed server-side extension seams.

Documentation refresh: April 25, 2026

## The One-Sentence Intent

Build a serious commerce engine that developers can understand, self-host, extend, and trust without inheriting a black-box SaaS platform or a demo-only starter kit.

## What Doopify Is

Doopify is:

- a full-stack commerce app
- a developer-first product foundation
- a self-hostable single-store commerce engine first
- a future platform only after the core app proves itself
- a real admin plus real storefront
- a Prisma/Postgres-backed source of truth
- a Stripe-backed checkout architecture
- a typed event-driven extension surface
- a place where integrations start as explicit server-side code, not magical runtime plugins

## What Doopify Is Not

Doopify is not currently:

- a theme marketplace
- a plugin marketplace
- a multi-tenant SaaS
- a schema-generated admin experiment
- a headless-only API with no product experience
- a visual prototype
- a fake checkout demo
- a system where the browser decides payment truth

## Positioning

Use this externally:

> Doopify is a developer-first, self-hostable commerce engine built with Next.js, Prisma, PostgreSQL, and Stripe. It gives developers a real admin, a real storefront, server-owned checkout logic, verified webhook order creation, and typed server-side extension seams.

Use this internally:

> Make the single-store commerce loop reliable before extracting platform pieces.

Avoid this as primary positioning:

> Shopify clone.

That phrase can be useful as a quick mental model, but it undersells the developer-first and self-hostable angle.

## Product Pillars

### 1. Real Commerce Before Platform Theater

The app must work as a commerce product before it becomes a platform.

Build and harden:

- catalog
- collections
- checkout
- payment confirmation
- orders
- inventory
- admin workflows
- storefront merchandising
- operational visibility

Then extract platform pieces.

### 2. Prisma/Postgres As The Source Of Truth

Prisma owns the commerce schema. PostgreSQL owns persistence.

Rules:

- Do not create parallel fake models in UI state.
- Do not bypass Prisma for core domain writes.
- Use Prisma relations and constraints to protect business invariants.
- Prefer explicit schema evolution over loose JSON blobs for core commerce entities.
- Use snapshots only when historical payment/order truth must be preserved.

### 3. Server-Owned Checkout

The client can collect intent. The server owns money.

Checkout must:

- validate live product and variant data
- recompute prices server-side
- validate inventory server-side
- create/persist a checkout session
- create the Stripe payment intent
- treat verified Stripe webhook success as the order finalization trigger

The browser redirect is useful for UX. It is not the source of truth.

### 4. Typed Server-Side Extension Seams

Doopify should be extendable before it is pluggable.

Current model:

- typed internal event map
- server-only dispatcher
- static integration registry
- first-party consumers for logging and confirmation email

Future model:

- outbound merchant webhooks
- integration settings and secrets
- retry and replay tooling
- versioned plugin manifest only when the event contract is stable

### 5. Handcrafted Admin Until Generation Is Earned

The current admin is product-specific and useful. It should not be replaced by generated CRUD screens before the product workflows are stable.

Generation can help later with scaffolding. It should not replace:

- checkout operations
- fulfillment workflows
- collection merchandising
- settings workflows
- payment and refund flows
- merchant-facing UX decisions

### 6. Self-Hostable By Default

A developer should be able to clone, configure, run, inspect, extend, and deploy Doopify without needing a hidden hosted control plane.

Self-hostable means:

- clear environment variables
- explicit database setup
- predictable build commands
- inspectable services
- documented route/API surfaces
- replaceable infrastructure choices over time
- operational notes for production readiness

## Architecture Boundaries

### Storefront

Responsibilities:

- display catalog and collections
- show branding-safe store settings
- manage cart UX
- initiate checkout
- render checkout success/failure state

Rules:

- never directly mutate the database
- never calculate final payment truth
- prefer server-backed reads
- use storefront-safe DTOs
- avoid exposing admin/private fields

### Admin

Responsibilities:

- authenticate merchants/admin users
- manage catalog, media, orders, discounts, customers, settings, analytics, and collections
- initiate admin-only mutations
- display operational state

Rules:

- every private action must be authenticated and authorized
- admin APIs should stay separate from public storefront APIs
- local state may optimize UX, but the database remains the source of truth
- route handlers should delegate business logic to services

### API And Services

Responsibilities:

- validation
- auth/session checks
- business rules
- persistence
- Stripe/payment orchestration
- event emission

Rules:

- route handlers stay thin
- service modules own business logic
- all core DB access goes through Prisma
- errors should be structured and safe
- response shapes should remain consistent

### Database

Responsibilities:

- persistent commerce truth
- relational integrity
- business constraints where possible
- historical snapshots where mutable product data would otherwise distort past orders

Rules:

- indexes belong on lookup paths
- unique constraints should protect idempotency
- avoid duplicating data unless preserving historical truth or improving measured performance
- schema changes must be paired with service/API updates

## Money And Inventory Rules

- Store money in integer minor units.
- Never trust client-submitted totals.
- Use one pricing service as discounts, shipping, and tax grow.
- Persist checkout/order snapshots where historical accuracy matters.
- Inventory decrement happens after verified payment success.
- Duplicate webhook delivery must not create duplicate orders.
- Race conditions must not push stock negative.

## Extension Rules

Allowed now:

- typed events
- first-party integrations
- static registry
- outbound webhook foundation
- explicit settings/secrets management

Deferred:

- runtime plugin loading from the filesystem
- public plugin marketplace
- unversioned plugin contracts
- arbitrary third-party code execution inside the main app

## Launch Claim Discipline

Safe claims:

- Developer-first commerce engine
- Self-hostable app foundation
- Real admin plus real storefront
- Prisma/Postgres-backed commerce data
- Stripe-backed checkout architecture
- Verified webhook order finalization
- Typed server-side extension seams
- Collection-driven merchandising

Avoid until built and hardened:

- Plugin marketplace
- Theme marketplace
- Multi-tenant SaaS
- Fully generated admin
- Enterprise-grade tax engine
- Drop-in Shopify replacement for every merchant type

## Definition Of Success

Doopify succeeds when a developer can:

1. clone it
2. configure Postgres and Stripe
3. run the admin and storefront
4. create products and collections
5. check out through Stripe
6. see orders finalized from verified webhooks
7. understand how data flows through Prisma services
8. extend server behavior through typed events
9. deploy it without hidden platform dependencies
10. trust the core commerce loop under failure and retry conditions


---


# File: `features-roadmap.md`

# Doopify Features Roadmap

> Single source of truth for what is shipped, what is next, and what is intentionally deferred.
>
> Documentation refresh: April 25, 2026  
> Last repo verification recorded in active docs: April 22, 2026  
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
- Internal typed event dispatcher plus a static integration registry
- First-party event consumers for logging and order confirmation email delivery
- Public storefront settings endpoint for branding-safe store data
- Collection service layer and storefront-safe collection DTOs
- Admin collection workspace at `/admin/collections`
- Storefront collection browsing at `/collections` and `/collections/[handle]`

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
- checkout session persistence with paid and failed state tracking
- idempotent order creation keyed off Stripe payment intent
- inventory decrement only after verified payment success
- order confirmation email trigger after `order.paid`

### Remaining Follow-Up

- discount application inside checkout totals
- more complete tax logic
- configurable shipping zones and rates
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

Status: active now

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
- the recommended build order is collections first, then checkout pricing hardening, then storefront merchandising, then automated coverage

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

- collection publish and unpublish semantics are still pending
- automated coverage for collections and the checkout plus webhook path is still pending

## Phase 4 - Extract Platform Pieces

Status: later, after the current app is stable

### Goals

- extract shared domain and service logic into packages
- introduce an SDK and lightweight CLI or template tooling
- use code generation as scaffolding for new resources, not as a replacement for the existing product and order flows
- keep the main deployable app as the proving ground until extraction is justified by real reuse

## Phase 5 - Public Plugin Platform

Status: deferred until after Phase 3 and Phase 4 prove out

### Requirements Before We Market This

- versioned plugin manifest
- stable supported event contract
- settings schema and admin surfaces for integrations
- compatibility and upgrade rules
- retry and observability story for failed handlers
- clear isolation model and ownership boundaries

## Verification And Testing

Validated in this repo on April 22, 2026:

```bash
npx prisma generate
npx tsc --noEmit
npm run build
```

Next automated coverage priorities:

- checkout creation success and validation failures
- duplicate Stripe webhook delivery idempotency
- invalid webhook signature rejection
- stock exhaustion and race-condition handling
- collection assignment and storefront collection visibility
- collection auth and storefront-safe DTO exposure

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


---


# File: `HARDENING.md`

# Doopify Hardening Status

> Security, correctness, and operational readiness for the commerce loop.
>
> Documentation refresh: April 25, 2026  
> Last repo verification recorded in active docs: April 22, 2026  
> Companion to `STATUS.md` and `features-roadmap.md`.

## Why Hardening Matters

Doopify is now a real commerce app. The most important risks are no longer visual polish. They are payment correctness, inventory correctness, auth/session integrity, safe public data exposure, and operational debuggability.

## Closed In This Pass

### Auth And Session Integrity

- `src/lib/env.ts` validates critical environment variables up front
- JWT validation checks the backing `Session` record, so logout and session revocation are real
- login is rate-limited by IP plus email
- shared cookie parsing lives in `src/lib/cookies.ts` instead of ad hoc regexes

### Route Protection

- `src/proxy.ts` uses boundary-safe public-prefix matching
- admin and private API protection is running through the active Next.js 16 proxy hook
- the old idea of adding `src/middleware.ts` was intentionally not kept because the repo should not maintain both proxy and middleware flows

### Media And Public Data Safety

- SVG uploads are no longer accepted
- upload MIME is verified from file bytes instead of trusting the browser-reported type
- upload linking verifies the target product before attaching media
- storefront product APIs return explicit public DTOs instead of raw Prisma payloads
- public storefront settings are exposed through a safe read-only endpoint
- storefront collection APIs split summary and detail payloads so list surfaces avoid nested product overfetching

### Order And Checkout Correctness

- order totals are recomputed server-side
- checkout validates live variant pricing and inventory before creating the payment intent
- orders are created only from verified Stripe webhook success
- duplicate webhook deliveries are handled idempotently through the payment-intent path
- checkout failure state is persisted and surfaced on the success-page polling flow

### Internal Extensibility Without Premature Plugin Complexity

- typed internal events are in place
- event handlers execute through a static registry instead of a runtime filesystem loader
- order confirmation email is driven from the `order.paid` event

## Verified

The repo passed these checks on April 22, 2026:

```bash
npx prisma generate
npx tsc --noEmit
npm run build
```

## Remaining Hardening Work

### High Priority

- Add automated tests for checkout totals, webhook idempotency, invalid signatures, and inventory exhaustion
- Keep pricing authority on the server as discounts, shipping logic, and tax handling evolve in Phase 3
- Add automated checks for collection CRUD, storefront-safe collection DTO exposure, and collection mutation performance regressions
- Move rate limiting from in-memory process state to a shared store before multi-instance deployment
- Review and normalize production Postgres SSL settings so environments explicitly use `sslmode=verify-full`

### Medium Priority

- Extract the remaining business logic that still lives in route handlers, especially analytics, discounts, and media administration paths
- Keep collection assignment and merchandising APIs admin-only while storefront collection reads stay public and read-only
- Add outbound webhook delivery logs, retries, and replay tooling
- Add stronger audit logging around settings changes, payment events, and fulfillment operations

### Later

- Move media binary storage off Postgres and into object storage
- Add customer-auth hardening when the customer account system exists
- Add broader CSP and response-header hardening once external integrations and asset origins are finalized

## Payment And Checkout Invariants

These invariants should not be broken by future work:

- the browser may start checkout
- the server recalculates checkout totals
- the server validates live variant pricing and inventory
- the server creates and persists the checkout session
- Stripe webhook success finalizes order creation
- browser redirect success does not create the order
- duplicate Stripe events do not create duplicate orders
- inventory decrement happens only after verified payment success
- failed checkout state is persisted and visible to the user

## Pricing Hardening Target

As discounts, shipping, and tax are added, create or preserve one pricing authority.

Recommended ownership:

```txt
src/server/checkout/pricing.ts
```

The pricing service should own:

- line validation
- variant/product availability checks
- subtotal
- discount calculation
- shipping calculation
- tax calculation
- total
- currency
- rounding
- checkout snapshot shape

Rules:

- use integer minor units for money
- never trust client-submitted totals
- persist enough snapshot data to keep historical order truth accurate
- keep browser display logic separate from server pricing authority

## Inventory Hardening Target

Inventory changes should be transaction-safe.

The service should prove:

- successful payment can decrement inventory
- duplicate webhook delivery does not double-decrement
- competing purchases cannot push stock negative
- insufficient stock fails clearly
- order/payment state remains consistent if inventory mutation fails

## Webhook Hardening Target

Webhook operations should become observable and replayable.

Add durable provider-event tracking for:

- provider
- provider event id
- event type
- status
- attempts
- processed timestamp
- last error
- payload hash

This enables:

- duplicate detection
- safe replay
- failed-email debugging
- duplicate-delivery debugging
- support/admin visibility

## Explicit Non-Goals

These ideas were intentionally rejected for this phase:

- creating Stripe PaymentIntents from `order.created`
- exposing Stripe under `/app/api/stripe/webhook/route.ts`
- adding a root-level `fs` plus `require()` plugin loader
- replacing the current admin with fully generated CRUD screens
- treating payment redirects as order finalization

## Operational Notes

- The correct public webhook endpoint is `POST /api/webhooks/stripe`
- The browser may start checkout, but only Stripe webhook success finalizes order creation
- Internal event handlers are allowed to fail without corrupting already-committed order or payment data
- Media binary storage in Postgres is acceptable for local/current workflows but should move to object storage before heavier production usage
- In-memory rate limiting must move to a shared store before multi-instance deployment

## Exit Criteria For The Next Hardening Pass

The next hardening milestone is complete when:

- checkout and webhook flows have automated coverage
- new collection APIs are covered by DTO and auth expectations
- failed webhook deliveries can be replayed safely
- operational logging is good enough to debug a missing email or duplicate delivery without inspecting the database manually
- production database SSL behavior is explicit and documented


---


# File: `CONTRIBUTING.md`

# Contributing To Doopify

> Development rules for a developer-first, self-hostable commerce engine.
>
> Documentation refresh: April 25, 2026

## Start Here

Before changing code, read:

1. `STATUS.md`
2. `PROJECT_INTENT.md`
3. `features-roadmap.md`
4. `HARDENING.md`

Do not rely on deleted AI-agent notes, old `CLAUDE.md` content, or legacy `skill.md` content for current product status.

## Core Development Rules

### Use The Existing Architecture

Prefer extending current services, route handlers, DTOs, and Prisma models over creating parallel implementations.

Do not:

- bypass Prisma for core domain writes
- build fake state that competes with the database
- duplicate checkout, webhook, or collection foundations
- replace the handcrafted admin with generated CRUD
- add runtime plugin loading
- introduce new frameworks without a clear reason

### Keep Layers Clean

UI components:

- render state
- call route handlers or server-backed actions
- avoid embedding business logic
- never own payment truth

Route handlers:

- parse requests
- validate input
- authenticate/authorize
- call service modules
- return consistent responses

Services:

- own business logic
- call Prisma
- enforce commerce invariants
- emit typed events when useful

Prisma/Postgres:

- own persistent domain truth
- define relations, indexes, and uniqueness
- protect idempotency when possible

### Keep Checkout Server-Owned

Never trust the browser for:

- product price
- discount amount
- shipping amount
- tax amount
- total
- inventory availability
- payment success

The browser can initiate checkout. The server and Stripe webhook finalize the commerce state.

### Protect Public Data

Storefront responses should use public DTOs.

Do not expose:

- private admin fields
- raw Prisma payloads when a DTO is expected
- session data
- unpublished merchant data
- internal integration settings
- payment secrets

### Preserve Typed Extension Seams

Use the typed event system for internal integration behavior.

Do not introduce:

- dynamic filesystem plugin loading
- arbitrary `require()` plugin execution
- public plugin marketplace assumptions
- unstable unversioned third-party contracts

## Response Format

Keep API responses consistent.

Success:

```json
{
  "success": true,
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "error": "Message"
}
```

Rules:

- never expose raw server errors to clients
- use clear user-safe error messages
- log enough internal context to debug failures
- keep response shapes stable

## Money Rules

- Store money in integer minor units.
- Do not use floating point math for persisted currency totals.
- Recompute totals on the server.
- Add discounts, shipping, and tax through a central pricing path.
- Persist snapshots for order history where product data can change later.

## Inventory Rules

- Validate inventory before creating checkout sessions.
- Decrement inventory only after verified payment success.
- Use idempotency to avoid double-decrement on duplicate webhooks.
- Add race-condition coverage before launch claims.
- Never let stock go negative.

## Collection Rules

- Admin collection mutations must stay private.
- Storefront collection reads must stay public and read-only.
- List views should use summary payloads.
- Detail views may load nested product data.
- Collection publish/unpublish semantics are still pending and should be added intentionally.
- Revalidate targeted storefront paths instead of broadly refreshing everything.

## Testing Priorities

Add automated coverage in this order:

1. checkout creation success
2. checkout validation failures
3. invalid webhook signature rejection
4. duplicate webhook delivery idempotency
5. inventory exhaustion and race conditions
6. collection assignment behavior
7. storefront collection visibility and DTO safety
8. admin-only collection mutations
9. discount/shipping/tax pricing behavior as those features land

## Recommended Verification

Run before merging meaningful work:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

If tests are not installed yet, add them as part of the revenue-path hardening work rather than treating the absence of tests as acceptable.

## Definition Of Done

A feature is done when:

- it works end-to-end from DB to API/service to UI
- it survives refresh and navigation
- it handles validation failures cleanly
- it does not expose private data publicly
- it respects server-owned checkout and payment invariants
- it uses Prisma as the source of truth
- it emits typed events when integration behavior is needed
- it has automated coverage if it touches checkout, webhook, inventory, auth, or public DTO boundaries
- build and typecheck pass
- docs/status are updated if behavior or roadmap status changed

## Documentation Rule

When a feature changes status:

- update `STATUS.md`
- update `features-roadmap.md` if it affects product sequencing
- update `HARDENING.md` if it affects security, correctness, or operational readiness
- update `README.md` only when onboarding, routes, or headline status change

Do not create a new root-level status file.


---


# File: `AGENTS.md`

# Doopify Agent Instructions

> This file replaces the old `CLAUDE.md` workflow.  
> It exists to guide AI coding agents and future maintainers without creating a second conflicting roadmap.

Documentation refresh: April 25, 2026

## Required Reading Order

Before writing code, read:

1. `STATUS.md`
2. `PROJECT_INTENT.md`
3. `features-roadmap.md`
4. `HARDENING.md`
5. `CONTRIBUTING.md`

If these files conflict, treat `STATUS.md` as the current state, `features-roadmap.md` as the build sequence, and `HARDENING.md` as the security/correctness backlog.

## Current Repo Truth

Doopify is a real DB-backed commerce app, not a prototype.

Implemented:

- Prisma/Postgres-backed commerce schema
- protected admin auth with session-backed JWT validation
- private route protection through `src/proxy.ts`
- DB-backed admin APIs for products, orders, customers, discounts, analytics, settings, media, and collections
- storefront product routes at `/`, `/shop`, and `/shop/[handle]`
- storefront collection routes at `/collections` and `/collections/[handle]`
- checkout flow at `/checkout`
- `POST /api/checkout/create`
- `POST /api/webhooks/stripe`
- `GET /api/checkout/status`
- idempotent order creation from verified Stripe payment success
- inventory decrement after verified payment success
- typed internal event dispatcher
- static integration registry
- first-party logging and order confirmation email consumers

Current active phase:

- **Phase 3 - Merchant Readiness And Storefront Differentiation**

Current priorities:

1. automated revenue-path coverage
2. checkout pricing hardening for discounts, shipping, and tax
3. collection publish/unpublish semantics
4. storefront merchandising and branding improvements
5. operational hardening

## What Not To Rebuild

Do not rebuild these foundations unless source inspection proves they are broken:

- Prisma commerce schema
- admin auth/session foundation
- product admin persistence
- media library foundation
- storefront product catalog routes
- checkout creation route
- Stripe webhook route
- checkout status route
- collection service/API/storefront foundation
- typed event dispatcher
- static integration registry

## Agent Rules

### No Placeholder Commerce Logic

Do not write fake payment, fake order, fake inventory, or fake pricing logic unless explicitly asked for a mock.

If a feature touches money, inventory, auth, or public/private data boundaries, implement it against the real service architecture.

### Use Existing Patterns

Before adding a file:

- search for an existing service
- search for an existing DTO
- search for an existing route response pattern
- search for existing validation helpers
- search for existing event types

Extend what exists when possible.

### Keep Route Handlers Thin

Route handlers should:

- parse request input
- validate
- authorize
- call a service
- return a consistent response

Business logic belongs in service modules.

### Keep Prisma Central

All core commerce persistence should go through Prisma.

Do not introduce a second data source of truth.

### Keep Checkout Server-Owned

The client does not own:

- totals
- discounts
- shipping
- tax
- inventory truth
- payment success
- order creation

Verified Stripe webhook success finalizes orders.

### Keep Extension Seams Typed

Use typed events and the static registry for internal integrations.

Do not add runtime plugin loading or marketplace mechanics yet.

### Respect Next.js Version Drift

This repo uses Next.js 16 conventions. Before touching framework-specific behavior, check the installed Next.js docs or existing project code.

Be especially careful with:

- `src/proxy.ts`
- App Router route handlers
- caching and revalidation
- server/client component boundaries

## Current Best Next Tasks

The strongest next tasks are:

1. Add automated tests for checkout, webhook idempotency, invalid webhook signatures, inventory exhaustion, and collections
2. Centralize/strengthen checkout pricing for discounts, shipping, and tax
3. Add collection publish/unpublish semantics
4. Add webhook delivery logging and replay support
5. Move rate limiting to a shared store before multi-instance deployment
6. Add audit logging for settings, payment events, and fulfillment

## Definition Of Done For Agent Work

A change is complete when:

- it fits the existing architecture
- it does not contradict `STATUS.md`
- it keeps Prisma/Postgres as the source of truth
- it preserves server-owned checkout
- it does not expose private fields publicly
- it handles errors cleanly
- it updates status docs when status changes
- it passes the relevant verification commands

Recommended verification:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

If `npm run test` does not exist yet, do not silently ignore the gap for revenue-path work. Add or document the needed test setup.

## Documentation Updates

When a shipped/pending/deferred status changes, update:

- `STATUS.md`
- `features-roadmap.md`
- `HARDENING.md` if security/correctness/ops changed
- `README.md` if onboarding or public repo orientation changed

Do not recreate `CLAUDE.md`.


---


# File: `PHASE_3_KICKOFF.md`

# Phase 3 Kickoff - Merchant Readiness And Storefront Differentiation

> Active execution brief.
>
> Documentation refresh: April 25, 2026  
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
- admin collection APIs
- admin collection workspace
- storefront collection APIs
- storefront collection routes
- collection merchandising on homepage/shop surfaces
- targeted collection revalidation
- local admin collection mutation state updates

## Phase 3 Build Order

### 1. Stabilize Collections

Finish and verify:

- create collection
- edit collection
- delete collection
- assign products
- order products inside a collection
- view collections on storefront
- view collection detail pages
- protect admin-only mutations
- expose only storefront-safe DTOs publicly
- add publish/unpublish semantics

Acceptance:

- merchants can manage collections without manual DB changes
- public users can browse collections without seeing private fields
- list pages avoid nested product overfetching
- collection mutations do not reload the entire admin workspace unnecessarily

### 2. Harden Checkout Pricing

Centralize pricing so discounts, shipping, and tax do not scatter across UI and route handlers.

Pricing service should own:

- live item validation
- product/variant availability
- subtotal
- discounts
- shipping
- tax
- total
- currency
- rounding
- persisted checkout snapshot

Acceptance:

- browser never owns totals
- discount logic changes do not require rewriting checkout route internals
- shipping/tax additions do not move pricing client-side
- checkout and webhook behavior remains idempotent

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

### 4. Add Automated Coverage

Prioritize tests around revenue and trust boundaries:

- checkout creation success
- checkout validation failures
- invalid Stripe webhook signature
- duplicate webhook event
- inventory exhaustion
- collection admin auth
- storefront-safe collection DTOs
- collection assignment behavior

Acceptance:

- core commerce loop can be changed with confidence
- launch demos are backed by repeatable verification

### 5. Strengthen Storefront Merchandising

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


---


# File: `LAUNCH_ROLLOUT.md`

# Doopify Launch Rollout

> Positioning and rollout guide for the developer-first, self-hostable commerce story.
>
> Documentation refresh: April 25, 2026

## Core Positioning

Doopify is a developer-first, self-hostable commerce engine built with Next.js, Prisma, PostgreSQL, and Stripe.

It gives developers:

- a real admin
- a real storefront
- Prisma/Postgres as the source of truth
- server-owned checkout logic
- Stripe-backed payment architecture
- verified webhook order finalization
- typed server-side extension seams
- a path to customize commerce without starting from scratch

## The Cleanest Launch Line

> A developer-first, self-hostable commerce engine with a real admin, real storefront, Prisma/Postgres at the core, Stripe-backed checkout, and typed server-side extension seams.

## What To Show In Demos

### Demo Path 1 - Merchant Creates Storefront Structure

1. Log in to admin
2. Create or edit products
3. Upload media
4. Create a collection
5. Assign products to the collection
6. Visit `/collections`
7. Open `/collections/[handle]`
8. Show homepage/shop merchandising using collection data

Proof point:

- The admin and storefront use the same DB-backed commerce model.

### Demo Path 2 - Checkout Trust Path

1. Add products to cart
2. Start checkout at `/checkout`
3. Create a live-priced checkout session
4. Complete payment through Stripe test flow
5. Let the verified webhook finalize order creation
6. Show order status reconciliation
7. Show inventory decrement and order record

Proof point:

- Browser redirects do not create orders. Verified payment success does.

### Demo Path 3 - Developer Extension Path

1. Show typed event map
2. Show server-only dispatcher
3. Show static integration registry
4. Show order confirmation email consumer
5. Show where outbound webhooks/audit logs can plug in next

Proof point:

- Doopify is extendable without pretending a public plugin marketplace is already complete.

## Strong Claims

Use these:

- Developer-first commerce engine
- Self-hostable commerce foundation
- Real admin plus real storefront
- Prisma/Postgres-backed source of truth
- Stripe-backed checkout architecture
- Verified webhook order finalization
- Typed server-side extension seams
- Collection-driven merchandising
- Built to be extended by developers

## Claims To Avoid For Now

Avoid these until they are actually built, tested, and documented:

- plugin marketplace
- theme marketplace
- multi-tenant SaaS
- complete Shopify replacement
- enterprise tax automation
- generated admin platform
- arbitrary third-party plugin runtime
- production-scale CDN media pipeline

## Audience

### Primary Audience

Developers who want:

- ownership over their commerce stack
- a real starting point instead of a toy starter
- Prisma/Postgres as an understandable data layer
- Stripe checkout they can inspect and customize
- server-side extension seams
- a self-hostable path

### Secondary Audience

Founders and technical merchants who want:

- a customizable commerce base
- less lock-in
- a product they can adapt
- a clear path from simple store to custom workflows

## Message Pillars

### 1. Own The Stack

You can inspect, modify, and deploy the commerce engine yourself.

### 2. Real Commerce Loop

Admin, storefront, checkout, webhooks, orders, and inventory are connected through the same app.

### 3. Built For Developers

The system favors explicit services, typed events, Prisma models, and clear route boundaries.

### 4. Extend Before Marketplace

Doopify has typed server-side extension seams now. Public plugin platform later.

### 5. Self-Hostable First

No hidden hosted control plane is required for the core app.

## Launch Readiness Checklist

Before making larger public claims:

- [ ] Collections are demoable end-to-end
- [ ] Checkout test path is reliable
- [ ] Webhook order creation is demonstrable
- [ ] Inventory decrement is visible
- [ ] Confirmation email flow is demonstrable or clearly labeled as first-party event consumer
- [ ] Checkout/webhook/inventory path has automated coverage
- [ ] README accurately matches current behavior
- [ ] `STATUS.md`, `features-roadmap.md`, and `HARDENING.md` are up to date
- [ ] Known gaps are called out honestly

## Suggested README Badge/Tagline Copy

```md
Developer-first commerce engine with a real admin, real storefront, Prisma/Postgres source of truth, Stripe-backed checkout, and typed server-side extension seams.
```

## Suggested Short Product Description

```md
Doopify is a self-hostable commerce engine for developers who want a real admin, a real storefront, and a customizable server-side commerce stack. It uses Next.js, Prisma, PostgreSQL, and Stripe, with verified webhook order finalization and typed internal events for integrations.
```

## Suggested Social Copy

```txt
Building Doopify: a developer-first, self-hostable commerce engine.

Real admin.
Real storefront.
Prisma/Postgres source of truth.
Stripe-backed checkout.
Typed server-side extension seams.

Not a toy starter. Not a black box.
```
