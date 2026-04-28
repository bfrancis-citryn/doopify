# Doopify Agent Instructions

> This file replaces the old `CLAUDE.md` workflow.  
> It exists to guide AI coding agents and future maintainers without creating a second conflicting roadmap.

Documentation refresh: April 28, 2026

## Required Reading Order

Before writing code, read:

1. `docs/STATUS.md`
2. `docs/PROJECT_INTENT.md`
3. `docs/features-roadmap.md`
4. `docs/HARDENING.md`
5. `docs/CONTRIBUTING.md`
6. `docs/TRANSACTIONAL_EMAIL_OBSERVABILITY_PLAN.md` when working on the current email observability slice
7. `docs/SETUP_AND_CLI_PLAN.md` when working on setup diagnostics, Setup tab, or CLI deployment automation

If these files conflict, treat `docs/STATUS.md` as the current state, `docs/features-roadmap.md` as the build sequence, and `docs/HARDENING.md` as the security/correctness backlog.

Do not use files in `docs/archive/` as current status.

## Current Repo Truth

Doopify is a real DB-backed commerce app, not a prototype.

Implemented:

- Prisma/Postgres-backed commerce schema
- protected admin auth with session-backed JWT validation
- private route protection through `src/proxy.ts`
- DB-backed admin APIs for products, orders, customers, discounts, analytics, settings, media, collections, integrations, inbound webhook deliveries, and outbound webhook deliveries
- storefront product routes at `/`, `/shop`, and `/shop/[handle]`
- storefront collection routes at `/collections` and `/collections/[handle]`
- checkout flow at `/checkout`
- `POST /api/checkout/create`
- `POST /api/webhooks/stripe`
- `GET /api/checkout/status`
- idempotent order creation from verified Stripe payment success
- inventory decrement after verified payment success
- centralized checkout pricing service in `src/server/checkout/pricing.ts`
- checkout-native code discounts validated and applied through the server pricing authority
- settings-backed shipping/tax rates and persisted shipping-zone/rate and jurisdiction tax-rule config consumed by checkout pricing
- collection service layer, storefront-safe collection DTOs, collection publish/unpublish semantics
- durable Stripe webhook delivery logging with verified local payload storage and retry metadata
- local-payload replay API, retry scheduling and exhaustion, cron-compatible retry runner (`POST /api/webhook-retries/run`)
- admin webhook visibility workspace at `/admin/webhooks` with inbound/outbound delivery visibility and retry controls
- Phase 4 refund service with pending refund persistence, Stripe idempotency keys, payment/order status updates, validated item-level restocking, and return linkage
- Phase 4 return service with state-machine transitions, order-owned item validation, received-return close-with-refund support, and admin order action panels
- Phase 4 outbound merchant webhooks with subscriptions, timestamped HMAC signing, retry/backoff, delivery claiming, exhausted/dead-letter visibility, manual retry API, integration settings UI, and admin delivery visibility
- encrypted integration webhook secrets and custom `HEADER_` secrets, with edit behavior that preserves existing signing secrets unless explicitly cleared
- unique integration/event subscription constraint and deduped event writes
- typed internal event dispatcher
- static integration registry
- first-party logging and order confirmation email consumers
- fast Vitest test harness plus `DATABASE_URL_TEST`-gated real-DB integration specs covering checkout inventory, payment idempotency, discount usage, concurrent races, webhook retry idempotency, and refund/return lifecycle behavior

Current active phase:

- **Phase 4 - Merchant Lifecycle And Outbound Integrations**

Phase 3 is fully complete. Phase 4 refund/return and outbound merchant webhook foundations are shipped. Current priority order is: finish correctness hardening verification, transactional email observability, analytics fan-out, then Setup Wizard/CLI foundation.

Current priorities:

1. Verify Phase 4 correctness hardening locally with `db:generate`, `tsc`, tests, and build
2. Transactional email observability: delivery status, bounce/complaint handling, and safe resend tooling
3. Analytics event fan-out through the existing dispatcher
4. Setup Wizard and CLI foundation: `doopify doctor`, setup status API, Settings -> Setup tab, then `doopify setup`
5. Broader real-DB coverage for outbound webhook retry/idempotency and email behavior
6. Additional audit-log coverage around integration changes, webhook retries, email resends, refunds, and returns

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
- refund/return service foundation
- inbound webhook delivery/replay/retry foundation
- outbound merchant webhook delivery foundation
- integration settings/secrets foundation
- typed event dispatcher
- static integration registry

## Agent Rules

### No Placeholder Commerce Logic

Do not write fake payment, fake order, fake inventory, fake email, fake setup, or fake pricing logic unless explicitly asked for a mock.

If a feature touches money, inventory, auth, email delivery, setup/deployment, integrations, or public/private data boundaries, implement it against the real service architecture.

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

The client does not own totals, discounts, shipping, tax, inventory truth, payment success, or order creation.

Verified Stripe webhook success finalizes orders.

### Keep Extension Seams Typed And Observable

Use typed events, persisted delivery records, and the static registry for integrations.

Do not add runtime plugin loading or marketplace mechanics yet.

### Keep Setup Automation Split Correctly

The browser Setup tab may read setup status and guide the user. It must not run local shell commands.

Local file writes, provider API/CLI calls, Prisma commands, Vercel env changes, Neon setup, and Stripe webhook configuration belong in a local CLI such as `doopify doctor` / `doopify setup`.

### Respect Next.js Version Drift

This repo uses Next.js 16 conventions. Before touching framework-specific behavior, check the installed Next.js docs or existing project code.

Be especially careful with:

- `src/proxy.ts`
- App Router route handlers
- caching and revalidation
- server/client component boundaries

## Current Best Next Tasks

The following are shipped and must not be rebuilt from scratch:

- automated tests for checkout, webhook idempotency, invalid webhook signatures, inventory exhaustion, and collections — **shipped**
- centralized checkout pricing for discounts, shipping, and tax — **shipped** (`src/server/checkout/pricing.ts`)
- collection publish/unpublish semantics — **shipped**
- inbound webhook delivery logging, local-payload replay, retry, and admin visibility — **shipped** (`/admin/webhooks`)
- configurable shipping zones/rates and jurisdiction-aware tax rules — **shipped**
- shared rate-limit store, Postgres SSL normalization, audit logging — **shipped** (Phase 3 complete)
- storefront merchandising: `FeaturedCollectionsGrid`, branding tokens from settings — **shipped**
- refund service with pending persistence, Stripe idempotency, item validation, status updates, and restocking — **shipped foundation**
- return service with validated state machine, close-with-refund path, and returned-item refund bounds — **shipped foundation**
- admin order refund/return action panels and return workflow controls — **shipped foundation**
- outbound merchant webhook subscriptions, signing, retry/backoff, delivery claiming, dead-letter visibility, manual retry, settings UI, and admin visibility — **shipped foundation**

The strongest remaining tasks are:

1. Run the local verification gate after the latest correctness patches
2. Implement transactional email observability per `docs/TRANSACTIONAL_EMAIL_OBSERVABILITY_PLAN.md`
3. Add safe email resend APIs and admin visibility
4. Add provider bounce/complaint webhook handling when provider choice is finalized
5. Add analytics event fan-out through the dispatcher
6. Implement `doopify doctor` and the setup status service from `docs/SETUP_AND_CLI_PLAN.md`
7. Expand real-DB coverage for outbound webhook retry/idempotency and email delivery behavior

## Definition Of Done For Agent Work

A change is complete when:

- it fits the existing architecture
- it does not contradict `docs/STATUS.md`
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

- `docs/STATUS.md`
- `docs/features-roadmap.md`
- `docs/HARDENING.md` if security/correctness/ops changed
- `README.md` if onboarding or public repo orientation changed

Do not recreate `CLAUDE.md`, active Phase 3 kickoff docs, or a duplicate phase-completion roadmap.
