# Doopify Status

> Canonical status snapshot for developers, maintainers, and AI agents.
>
> Documentation refresh: April 27, 2026
> Last repo verification recorded in active docs: April 27, 2026
> Current active phase: **Phase 4 - Merchant Lifecycle And Outbound Integrations**

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
- Vitest-backed fast test harness with a gated integration-test entry point

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
- Public storefront collection reads exclude unpublished collections
- Public storefront settings endpoint for branding-safe store data
- Homepage and shop merchandising surfaces that can expose collections

### Admin

- Protected admin auth flow
- Product editor persistence and product-to-storefront sync
- Standalone media library with upload, alt text editing, deletion, and linked-product visibility
- DB-backed admin APIs for products, orders, customers, discounts, analytics, settings, media, and collections
- Admin settings shipping workspace now supports CRUD for shipping zones, zone rates, and jurisdiction-aware tax rules
- Admin collection workspace at `/admin/collections`
- Collection service layer
- Collection assignment and ordering support
- Collection publish/unpublish semantics
- Local-state collection mutation updates instead of full workspace reloads

### Checkout And Payments

- `/checkout`
- `POST /api/checkout/create`
- `POST /api/webhooks/stripe`
- `GET /api/checkout/status`
- Checkout validates live variant data
- Checkout recalculates totals server-side
- Checkout pricing is centralized in `src/server/checkout/pricing.ts`
- Checkout accepts server-validated code discounts through the centralized pricing path
- Checkout applies baseline destination-aware shipping zones/rates and tax rules through the centralized pricing path
- Checkout pricing now reads merchant-configurable shipping and tax rates from store settings
- Checkout pricing now resolves persisted shipping-zone/rate and tax-rule configuration from admin APIs
- Checkout payload snapshots now persist shipping/tax resolution decisions for historical order-checkout truth
- Admin pricing-configuration APIs now include:
  - `GET/POST /api/settings/shipping-zones`
  - `PATCH/DELETE /api/settings/shipping-zones/[zoneId]`
  - `POST /api/settings/shipping-zones/[zoneId]/rates`
  - `PATCH/DELETE /api/settings/shipping-zones/[zoneId]/rates/[rateId]`
  - `GET/POST /api/settings/tax-rules`
  - `PATCH/DELETE /api/settings/tax-rules/[ruleId]`
- Checkout validates inventory before creating payment intent
- Checkout session persistence
- Paid and failed status tracking
- Orders, payments, inventory decrements, and order events are created only after verified Stripe payment success
- Duplicate webhook deliveries are handled idempotently through the payment-intent path, including recovery when a race surfaces as a non-unique transaction error
- Discount applications and discount usage counts are created only after verified paid order creation succeeds
- Stripe webhook deliveries are durably logged with provider event id, type, status, attempts, processed timestamp, last error, payload hash, verified local payload storage, and retry metadata
- Admin webhook operations include local-payload replay APIs, support diagnostics, retry visibility, and an admin visibility workspace at `/admin/webhooks`
- Cron-compatible webhook retry execution is available at `POST /api/webhook-retries/run` behind `WEBHOOK_RETRY_SECRET`
- Checkout failure state is surfaced on the success-page polling flow

### Internal Extensibility

- Typed `DoopifyEvents` map in `src/server/events/types.ts`
- Server-only dispatcher in `src/server/events/dispatcher.ts`
- Static integration registry in `src/server/integrations/registry.ts`
- First-party consumers for logging and order confirmation email delivery
- Event emission from product, order, fulfillment, and failed-checkout flows

## Phase 3 — Complete

All slices 3A–3E are fully shipped. Phase 3 exit trigger has fired. Active phase is now Phase 4.

### Phase 3 Shipped

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
- Collection publish/unpublish semantics are backed by Prisma and storefront filtering
- Fast automated tests cover checkout pricing, shipping/tax zone behavior, checkout-native discount math, checkout creation, checkout discount-code input handling, checkout payload validation failure handling, checkout inventory-exhaustion rejection, duplicate payment-intent completion, invalid webhook signatures, webhook delivery logging behavior, admin collection mutations, storefront collection routes, and storefront-safe collection DTOs
- Fast automated tests now include representative shipping-zone/rate and jurisdiction tax-resolution matrix coverage
- Fast tests now also cover webhook replay APIs and settings-backed shipping/tax pricing behavior
- Fast tests now also cover verified webhook payload storage, local-payload replay, retry scheduling/exhaustion, retry runner authorization, due retry processing, and support diagnostics
- `npm run test:integration` executes successfully when `DATABASE_URL_TEST` points at a disposable Postgres database or schema
- Gated real-DB integration specs cover paid checkout inventory decrement, duplicate payment-intent idempotency, competing duplicate completions, insufficient-stock consistency, paid-only/idempotent discount application usage, concurrent checkout creation near stock-out, conflicting success/failure webhook delivery for one payment intent, paid-order finalization while email delivery fails, concurrent discount usage-cap enforcement, and late payment-success webhook delivery against expired sessions
- The real-DB run exposed and fixed a concurrent checkout customer-creation race; customer creation during payment-intent completion must stay idempotent
- Failure webhooks no longer downgrade already-paid checkout sessions, and capped discount usage is now concurrency-safe at paid-order finalization
- Webhook retry coverage proves a failed stored-payload delivery can finalize a paid order exactly once without duplicating payments, inventory decrements, or discount usage
- Checkout page includes an optional promo-code input that sends `discountCode` to `POST /api/checkout/create`; discount errors (code not found, usage exceeded) surface inline on the discount field rather than in the general error area
- Checkout error banner distinguishes inventory stock issues and unavailable items from general errors using the server's error message text
- Checkout success page failed state is more actionable: prominent "Try again" link, clear "your items are still available" messaging, and auto-polling notice
- `/collections` empty state replaced with an intentional branded empty state and a fallback link to the shop
- Collection detail empty state replaced with an intentional empty state and a fallback link to the shop
- `FeaturedCollectionsGrid` reusable storefront component created at `src/components/storefront/FeaturedCollectionsGrid.js`
- Homepage featured collections section uses `FeaturedCollectionsGrid` and shows store name from settings in nav and footer

## Active Phase 4 Scope

### Current Phase 4 Status

Phase 4 is active now. Phase 3 is fully complete (all slices 3A–3E shipped and verified).

### Phase 4 Current Priorities

1. Refund flow connected to Stripe, payment records, order state, and inventory restocking — with admin UX
2. Return flow with a clear state machine connected to refunds — with admin UX
3. Outbound merchant webhooks: subscriptions, signing, retry/backoff, dead-letter visibility — built on the existing typed event dispatcher and static integration registry
4. Per-integration settings and secrets management, encrypted at rest, surfaced in the admin
5. Transactional email observability: delivery status, bounce/complaint handling, resend tooling
6. Analytics event fan-out through the existing dispatcher

### Phase 4 Acceptance Checks

- An admin can issue a partial or full refund and order, payment, and inventory are consistent afterward
- A return moves through its state machine and triggers a refund correctly
- Outbound webhook deliveries are signed, retried with backoff, and visible in the admin
- Integration secrets never appear unencrypted at rest
- A bounced order confirmation email surfaces in the admin and can be resent without duplicating side effects
- Build and typecheck stay green throughout

## Remaining Product Work

### Highest Priority (Phase 4)

- Refund and return flows connected to payments and inventory
- Outbound merchant webhooks with subscriptions, signing, retry/backoff, and dead-letter visibility
- Per-integration settings and secrets management
- Transactional email observability and resend tooling
- Analytics event fan-out

### Medium Priority

- Audit log consumers (settings changes, payment events, fulfillment operations)
- Stronger admin-only collection mutation test coverage
- Keep expanding real-DB race-condition coverage as new behaviors land

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

- Expand automated tests for deeper checkout validation failures plus real-DB race-condition behavior beyond the current inventory/webhook/discount race coverage
- Keep the centralized pricing authority on the server as discounts, shipping logic, and tax handling evolve
- Add audit logging for settings changes, payment events, and fulfillment operations (Phase 4 scope)
- Ensure Phase 4 refund/return flows maintain payment and inventory invariants

### Medium Priority

- Extract remaining business logic that still lives in route handlers, especially analytics, discounts, and media administration paths
- Keep collection assignment and merchandising APIs admin-only
- Keep storefront collection reads public and read-only
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

Validated in this repo on April 27, 2026 (Phase 3 complete, Phase 4 kickoff):

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

`npm run test:integration` should be run with a disposable Postgres database/schema before making release claims about real-DB behavior.

When returning to the repo, run the current verification commands again before making release claims.

## Source Of Truth Rules

- `STATUS.md` tells you what is true now.
- `features-roadmap.md` tells you what to build next.
- `HARDENING.md` tells you what must become safer before production growth.
- `PROJECT_INTENT.md` tells you what Doopify is trying to become.
- `AGENTS.md` tells AI agents how to operate.
- Do not create another root-level roadmap that can drift from these files.
