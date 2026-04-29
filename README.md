# Doopify

> **Developer-first, self-hostable commerce engine.**
>
> Doopify is a real commerce application built with Next.js 16, Prisma, PostgreSQL, Stripe-backed checkout architecture, and typed server-side extension seams. It ships a protected admin, a storefront, database-backed services, and a clear path from single-store reliability to later platform extraction.

## Current Status

Documentation refresh: April 29, 2026
Last repo verification recorded in active docs: April 29, 2026

Doopify is no longer a prototype or only a UI shell. It has a working admin, storefront, checkout entry point, Stripe webhook path, Prisma/Postgres-backed commerce data, refunds/returns, inbound and outbound webhook observability, and typed internal event seams.

### Working now

- Protected admin auth with session-backed JWT validation
- Safe cookie parsing and required environment validation
- Login rate limiting by IP plus email
- DB-backed products, variants, media, customers, discounts, settings, analytics, orders, payments, fulfillments, refunds, returns, integrations, and sessions
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
- Configurable shipping zones/rates and jurisdiction-aware tax rules through the centralized server pricing path
- Discount applications and usage counts created only after verified paid-order creation succeeds
- Durable inbound Stripe webhook delivery logging with verified local payload storage, replay, retry tooling, support diagnostics, and visibility at `/admin/webhooks`
- Admin collection management at `/admin/collections`
- Collection publish/unpublish semantics with unpublished collections hidden from storefront reads
- Storefront-safe collection DTOs with summary/detail query separation
- Centralized checkout pricing service for server-owned subtotal, shipping, tax, discount, and total calculation
- Refund and return foundations with Stripe refund idempotency, item validation, return state machine, admin workflow controls, and return-to-refund linkage
- Outbound merchant webhook subscriptions, timestamped HMAC signing, retry/backoff, exhausted/dead-letter visibility, manual retry, settings UI, and admin visibility
- Public storefront settings endpoint for branding-safe store data
- Typed internal event dispatcher
- Static server-side integration registry
- First-party event consumers for logging, order confirmation email delivery, and durable lifecycle analytics fan-out
- Vitest fast test harness plus `DATABASE_URL_TEST`-gated integration specs for checkout inventory, payment idempotency, discount usage, webhook retry, and refund/return behavior

### Active phase

The current active product phase is **Phase 4: Merchant Lifecycle And Outbound Integrations**.

Phase 3 is fully complete. Phase 4 refund/return, outbound webhook, transactional email observability, and analytics fan-out foundations are shipped.

Current priorities:

1. Finish Phase 4 correctness hardening around integration secrets and outbound webhook retry/idempotency
2. Setup Wizard and CLI hardening: extend shipped deployment automation commands with non-interactive/dry-run and deeper provider provisioning
3. Production hardening and launch readiness: CI enforcement, deployment runbooks, recovery runbooks
4. Broader real-DB coverage for outbound webhook, analytics, and email retry/idempotency behavior
5. Continued audit-log expansion for lifecycle operations

### Known follow-up gaps

- Transactional email observability and resend tooling
- Setup Wizard and CLI non-interactive/provider-provisioning hardening
- Production automation hardening for one-command provider provisioning
- Broader real-DB coverage for outbound webhook retry/idempotency
- Integration secret encryption verification tests
- Moving media binary storage out of Postgres into object storage/CDN later

## Active Documentation Map

Start here when returning to the repo:

1. [`docs/STATUS.md`](./docs/STATUS.md) - current shipped, active, pending, and deferred status
2. [`docs/PROJECT_INTENT.md`](./docs/PROJECT_INTENT.md) - product intent, architecture principles, and non-goals
3. [`docs/features-roadmap.md`](./docs/features-roadmap.md) - product phases and build sequencing
4. [`docs/HARDENING.md`](./docs/HARDENING.md) - security, correctness, and operational readiness
5. [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) - development rules and definition of done
6. [`AGENTS.md`](./AGENTS.md) - instructions for AI coding agents and future maintainers
7. [`docs/TRANSACTIONAL_EMAIL_OBSERVABILITY_PLAN.md`](./docs/TRANSACTIONAL_EMAIL_OBSERVABILITY_PLAN.md) - next Phase 4 email observability implementation plan
8. [`docs/SETUP_AND_CLI_PLAN.md`](./docs/SETUP_AND_CLI_PLAN.md) - planned Setup Wizard and CLI deployment automation sequence
9. [`docs/PRODUCTION_RUNBOOK.md`](./docs/PRODUCTION_RUNBOOK.md) - production setup, deployment, and recovery runbooks
10. [`docs/LAUNCH_ROLLOUT.md`](./docs/LAUNCH_ROLLOUT.md) - launch positioning and claim discipline

Historical planning files live in `docs/archive/`. Do not use archived docs as current repo status.

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
- `/api/outbound-webhook-deliveries`
- `/api/outbound-webhook-deliveries/[id]/retry`
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
- Setup automation should run through a local CLI and safe setup-status APIs; the browser must not run local shell commands.
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

`DATABASE_URL_TEST` must point at disposable Postgres storage, never the normal development database.

Recommended merge gate:

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

Do not re-add `CLAUDE.md`, active Phase 3 kickoff docs, or duplicate phase-completion ledgers as separate roadmaps. They created status drift.

Use `AGENTS.md`, `docs/STATUS.md`, `docs/features-roadmap.md`, and `docs/HARDENING.md` for repo truth.
