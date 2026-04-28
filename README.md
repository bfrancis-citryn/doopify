# Doopify

> **Developer-first, self-hostable commerce engine.**
>
> Doopify is a real commerce application built with Next.js 16, Prisma, PostgreSQL, Stripe-backed checkout architecture, and typed server-side extension seams. It ships a protected admin, a storefront, database-backed services, and a clear path from single-store reliability to later platform extraction.

## Current Status

Documentation refresh: April 27, 2026
Last repo verification recorded in active docs: April 27, 2026

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
- Checkout-native code discounts through the centralized server pricing path
- Baseline destination-aware shipping zone rates and tax rules through the centralized server pricing path
- Settings-backed domestic/international shipping and tax rates flowing through the centralized server pricing path
- Discount applications and usage counts created only after verified paid order creation succeeds
- Durable Stripe webhook delivery logging with provider event id, type, status, attempts, processed timestamp, last error, payload hash, verified local payload storage, and retry metadata
- Admin/API webhook local-payload replay, retry tooling, support diagnostics, and visibility at `/admin/webhooks`
- Admin collection management at `/admin/collections`
- Collection publish/unpublish semantics with unpublished collections hidden from storefront reads
- Storefront-safe collection DTOs with summary/detail query separation
- Centralized checkout pricing service for server-owned subtotal, shipping, tax, discount, and total calculation
- Public storefront settings endpoint for branding-safe store data
- Typed internal event dispatcher
- Static server-side integration registry
- First-party event consumers for logging and order confirmation email delivery
- Vitest fast test harness plus `DATABASE_URL_TEST`-gated integration specs for checkout inventory, payment-idempotency, and discount-usage behavior

### Active phase

The current active product phase is **Phase 4: Merchant Lifecycle And Outbound Integrations**.

Phase 3 is fully complete — all slices 3A–3E shipped and verified.

Current priorities:

1. Refund flow connected to Stripe, payment records, order state, and inventory restocking
2. Return flow with a state machine connected to refunds
3. Outbound merchant webhooks: subscriptions, signing, retry/backoff, dead-letter visibility
4. Per-integration settings and secrets management, encrypted at rest
5. Transactional email observability and analytics event fan-out

### Known follow-up gaps

- Refund and return flows connected to payments and inventory (active Phase 4 work)
- Outbound merchant webhooks with subscriptions, signing, and retry (active Phase 4 work)
- Per-integration secrets management and transactional email observability (active Phase 4 work)
- Analytics event fan-out (active Phase 4 work)
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
8. [`PHASE_COMPLETION_PLAN.md`](./PHASE_COMPLETION_PLAN.md) - sequenced phase completion plan with current slice ledger
9. [`LAUNCH_ROLLOUT.md`](./LAUNCH_ROLLOUT.md) - launch positioning and claim discipline

Do not keep stale root-level planning files that contradict `STATUS.md`, `features-roadmap.md`, or `HARDENING.md`.

## Key Routes

### Admin pages

- `/orders`
- `/admin/collections`
- `/admin/webhooks`
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
- `/api/webhook-deliveries`
- `/api/webhook-deliveries/[id]`
- `/api/webhook-deliveries/[id]/replay`
- `/api/webhook-retries/run`
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

Run fast automated tests:

```bash
npm run test
```

Run integration tests when a disposable test database or schema is configured:

```bash
DATABASE_URL_TEST="postgresql://..." npm run test:integration
```

`DATABASE_URL_TEST` must point at disposable Postgres storage, never the normal development database. The integration-test wrapper runs Vitest through `npm exec` for more reliable Windows execution.

Recommended merge gate once tests are present:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run test:integration # when DATABASE_URL_TEST is configured
npm run build
```

## Database And Environment

This repo expects PostgreSQL through Prisma.

- Put `DATABASE_URL` and `DIRECT_URL` in `.env`
- Put app/runtime secrets in `.env.local`
- Set `WEBHOOK_RETRY_SECRET` for cron-compatible calls to `POST /api/webhook-retries/run`
- Production Postgres SSL should be reviewed and normalized so environments explicitly use `sslmode=verify-full`

## Notes On Media

Media is currently stored in Postgres through `MediaAsset.data` and served by `/api/media/[assetId]`.

That is acceptable for local development and current admin workflows. Moving to object storage or a CDN-backed image service remains a later production-readiness task.

## Do Not Reintroduce

Do not re-add `CLAUDE.md` as a separate roadmap. It was removed because it created status drift.

Use `AGENTS.md` for AI-agent instructions and `STATUS.md` plus `features-roadmap.md` for repo truth.
