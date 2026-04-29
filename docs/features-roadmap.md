# Doopify Features Roadmap

> Single source of truth for what is shipped, what is next, and what is intentionally deferred.
>
> Documentation refresh: April 29, 2026
> Last repo verification recorded in active docs: April 29, 2026
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
- `TRANSACTIONAL_EMAIL_OBSERVABILITY_PLAN.md` for the next Phase 4 email observability slice
- `SETUP_AND_CLI_PLAN.md` for the planned setup wizard and deployment CLI sequence
- `LAUNCH_ROLLOUT.md` for launch positioning and marketing rollout guidance

Historical planning docs are intentionally omitted from this active handoff pack. Do not use old `CLAUDE.md`, stale Phase 3 kickoff docs, or legacy phase-completion ledgers as current repo status.

## Snapshot

### Shipped In The Repo

- Prisma/Postgres-backed commerce schema with admin auth, sessions, catalog, customers, orders, discounts, media, settings, payments, fulfillments, refunds, returns, integrations, inbound webhook deliveries, and outbound webhook deliveries
- Next.js App Router API surface with protected admin routes and public storefront routes
- Hardened auth flow with session-backed JWT validation, safe cookie parsing, env validation, and login rate limiting
- Storefront catalog pages at `/`, `/shop`, `/shop/[handle]`, `/collections`, and `/collections/[handle]`
- Cart-to-checkout flow at `/checkout`
- `POST /api/checkout/create` for live-priced checkout session creation
- `POST /api/webhooks/stripe` for verified webhook processing
- `GET /api/checkout/status` for success-page reconciliation
- Idempotent order creation from verified Stripe payment success
- Checkout session persistence plus paid and failed status tracking
- persisted commerce money fields now use integer minor units (cents) at rest
- Inventory decrement only after verified payment success
- Checkout-native code discounts through the centralized pricing service
- Configurable shipping zones/rates and jurisdiction-aware tax rules consumed by server-owned checkout pricing
- Shipping settings Phase 1 foundation: `/api/settings/shipping` cents-safe admin API plus admin workspace at `/admin/settings/shipping` for shipping mode, manual flat rates, free-shipping threshold, zone/rate editing, and manual rate preview
- Checkout pricing snapshots that persist shipping/tax resolution decisions into checkout payloads
- Durable inbound Stripe webhook delivery logging with provider event id, type, status, attempts, processed timestamp, last error, payload hash, verified stored payloads, retry metadata, local-payload replay, diagnostics, cron-compatible retry tooling, and admin visibility
- Internal typed event dispatcher plus a static integration registry
- First-party event consumers for logging and order confirmation email delivery
- Durable server-side analytics event fan-out and `AnalyticsEvent` persistence for checkout/order/refund/return/email/webhook lifecycle events
- Prisma-backed background job abstraction for side effects with claiming, retries/backoff, exhaustion, and cron-compatible runner API
- Abandoned checkout recovery foundation with persisted checkout recovery fields, admin review APIs/UI, safe tokenized recovery payload API, and secret-protected due-send processing
- Brand Kit foundation with centralized Store branding fields, admin Brand Kit screen/API, and safe storefront/checkout/email branding defaults
- Private email delivery observability APIs for list/detail/resend with safe resend eligibility controls
- Public storefront settings endpoint for branding-safe store data
- Collection service layer and storefront-safe collection DTOs
- Admin collection workspace at `/admin/collections`
- Storefront collection browsing and collection publish/unpublish semantics
- Refund service with pending persistence, Stripe idempotency, item validation, payment/order status updates, restocking, and return linkage
- Return service with validated state machine, admin workflow controls, and close-with-refund path
- Outbound merchant webhook subscriptions, timestamped HMAC signing, retry/backoff, exhausted/dead-letter visibility, manual retry API, settings UI, admin delivery visibility, and delivery-claim hardening
- Integration edit hardening that preserves signing secrets unless explicitly cleared and deduplicates event subscriptions
- Vitest fast test harness covering pricing, checkout, discount math, checkout creation, webhook logging/replay/retry/diagnostics, collections, refund/return services, outbound webhook services, and outbound webhook APIs
- `DATABASE_URL_TEST`-gated integration specs for checkout/inventory/idempotency/race scenarios and refund/return lifecycle coverage

### Explicitly Deferred

- Public plugin marketplace positioning
- Runtime `fs` plus `require()` plugin loading
- Replacing the handcrafted admin with schema-generated CRUD UI
- Multi-tenant architecture before the single-store flow is stable
- Packaging full theme directories before branding tokens and reusable storefront components are settled
- Running local shell commands from the browser Setup tab

## Architecture Decisions

### 1. Foundation Is Already Here

The repo already has the schema, route handlers, admin shell, storefront catalog, auth, checkout entry point, Stripe webhook path, collections, lifecycle services, integration settings, inbound webhook observability, outbound webhook delivery, and DB-backed services.

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

Orders, payments, inventory decrements, discount applications, and order events are created only after Stripe confirms success through `POST /api/webhooks/stripe`.

Browser redirects are not the source of truth.

### 4. Integrations Are Explicit, Observable, And Typed

The repo uses a typed internal event map plus a static server-side integration registry.

Outbound merchant webhooks are queued from the same typed event seam and delivered through persisted `OutboundWebhookDelivery` records with signing, retry/backoff, delivery claiming, and admin visibility.

That remains the right intermediate step before any public plugin platform.

### 5. The Admin Stays Handcrafted

Code generation can help later with scaffolding, but the current admin is product-specific and useful. Replacing it now would create churn instead of value.

### 6. Setup Automation Belongs In A CLI Plus Safe Status APIs

The Settings -> Setup tab should verify setup state and guide next actions. Local file writes, provider CLI/API calls, Prisma commands, and Vercel/Neon/Stripe automation should run from a local CLI, not from browser-executed shell commands.

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

- transactional email observability and resend tooling
- broader email/bounce/complaint handling
- continued real-DB coverage for lifecycle behavior

## Phase 2 - Add Internal Extension Seams

Status: shipped initial implementation, expanded in Phase 4

### Implemented

- typed `DoopifyEvents` map in `src/server/events/types.ts`
- server-only dispatcher in `src/server/events/dispatcher.ts`
- static integration registry in `src/server/integrations/registry.ts`
- first-party consumers for logging and confirmation email delivery
- event emission from product, order, fulfillment, failed-checkout, refund, and return flows
- outbound webhook queueing through `queueOutboundWebhooks()`
- outbound merchant webhook delivery service with signing, retry/backoff, delivery claiming, manual retry, and admin visibility

### Next Expansion

- transactional email delivery observability
- additional audit log consumers around integration/lifecycle operations

## Phase 3 - Merchant Readiness And Storefront Differentiation

Status: shipped — all slices 3A–3E complete as of April 27, 2026

### Shipped

- collection service layer and storefront-safe DTOs
- admin collection APIs and workspace
- storefront collection APIs and routes
- homepage/shop collection merchandising
- collection publish/unpublish semantics
- checkout-native code discounts with server-owned validation
- persisted shipping-zone/rate and jurisdiction tax-rule configuration consumed by checkout pricing
- checkout payload pricing snapshots for historical order truth
- persisted commerce money naming now uses explicit `*Cents` fields and cents-native Stripe amounts
- private admin CRUD APIs for shipping zones, zone rates, and tax rules
- settings shipping workspace editor
- durable inbound Stripe webhook delivery logging, verified payload storage, replay, retry scheduling/exhaustion, support diagnostics, cron-compatible retry runner, and admin visibility
- broad fast and gated real-DB coverage for checkout, discounts, inventory, collections, webhooks, and race/idempotency behavior

## Phase 4 - Merchant Lifecycle And Outbound Integrations

Status: active; refund/return, outbound webhook, transactional email observability, and analytics fan-out foundations are shipped. Current work is setup/deployment hardening and broader lifecycle coverage.

### Goals

- refund flow connected to Stripe, payment records, order state, and inventory restocking
- return flow with a state machine connected to refunds
- outbound merchant webhooks: subscriptions, signing, retry with backoff, dead-letter visibility — built on the typed event dispatcher and static integration registry
- per-integration settings and secrets management, encrypted at rest
- transactional email observability: delivery status, bounce/complaint handling, resend tooling
- analytics event fan-out through the existing dispatcher

### Shipped Phase 4 Work

#### Refunds And Returns

- admin refund and return panels on order detail
- return workflow controls for approve, decline, mark in transit, mark received, and close with refund
- Stripe refund idempotency keys and pending refund persistence before external calls
- refund failure persistence without order/payment/inventory mutation
- item-level refund/restock validation
- return-to-refund linkage
- close-with-refund quantity and variant validation against actual return items
- fast tests and gated integration coverage for refund/return lifecycle behavior

#### Outbound Merchant Webhooks

- Prisma-backed integration, event subscription, secret, and outbound delivery models
- integration settings APIs and admin UI
- encrypted signing secrets and encrypted custom header secrets
- signing-secret preservation on integration edit unless explicitly cleared
- deduplicated event subscriptions plus a unique integration/event constraint
- typed-event-based delivery queueing
- timestamped HMAC signatures
- response-code/body recording
- retry/backoff and exhausted/dead-letter state
- delivery claim step before send to reduce duplicate overlapping retry jobs
- cron-compatible due retry processing through the existing retry runner
- manual retry API and admin retry button
- inbound/outbound delivery visibility in `/admin/webhooks`
- fast service and API coverage for queueing, signing, delivery, retry, exhaustion, listing, manual retry, and claim behavior

#### Analytics Event Fan-Out

- `AnalyticsEvent` Prisma model for durable lifecycle analytics persistence
- typed lifecycle analytics events for checkout creation/failure, order creation/payment, refund issuance, return requested/closed, email sent/failed, and webhook delivered/failed
- analytics consumer wired into the existing typed internal event registry
- analytics persistence isolated from commerce durability through handler-failure containment

#### Background Side-Effect Jobs

- Prisma-backed `Job` model and `JobStatus` lifecycle for persisted side effects
- job service with enqueue, claiming, running, retry scheduling, failure exhaustion, and safe admin-oriented payload redaction
- secure cron-compatible runner route at `POST /api/jobs/run`
- initial integration of order-confirmation email dispatch through the job abstraction so checkout/order/payment/inventory truth remains decoupled from email send success

#### Abandoned Checkout Recovery

- `CheckoutSession` recovery metadata (`abandonedAt`, token, send counters, recovered timestamp) persisted in Prisma/Postgres
- admin APIs for abandoned checkout list/detail, mark-due, due-send, and manual send actions
- secret-protected due-send route for cron execution and admin-triggered processing
- token-protected storefront recovery payload API at `GET /api/checkout/recover` with server-side repricing and safe payload shaping
- checkout completion marks `recoveredAt` only after verified payment success when recovery outreach occurred

#### Brand Kit

- Store branding fields persist logo/favicon, colors, fonts, button settings, email branding, checkout branding, and social links in Prisma/Postgres
- admin Brand Kit APIs at `GET/PATCH /api/settings/brand-kit` enforce route-level admin authorization and validation
- admin Brand Kit workspace at `/admin/brand-kit` provides visual identity editing with a live preview
- public storefront settings now include safe Brand Kit fields for storefront and checkout visual theming
- transactional email templates consume Brand Kit branding with safe fallbacks that do not block delivery

### Next Phase 4 Slice: Transactional Email Observability

See `TRANSACTIONAL_EMAIL_OBSERVABILITY_PLAN.md`.

Target work:

1. Add durable email delivery persistence — shipped.
2. Add an email delivery service and provider adapter seam — shipped.
3. Update order confirmation email consumer to record delivery status — shipped.
4. Add safe list/detail/resend APIs — shipped.
5. Add admin email delivery visibility — shipped in `/admin/webhooks`.
6. Add tests for success, failure, bounce/complaint state, and safe resend — shipped (service/API fast coverage, provider-webhook route coverage, and executed `DATABASE_URL_TEST` real-DB integration coverage for resend side effects and provider-state transitions).

### Phase 4 Acceptance Checks

- an admin can issue a partial or full refund and the order, payment, and inventory are consistent afterward — foundation shipped
- a return moves through its state machine and triggers a refund correctly — foundation shipped
- outbound webhook deliveries are signed, retried with backoff, claimed before send, and visible in the admin — foundation shipped
- integration secrets never appear unencrypted at rest — foundation shipped with real-DB update-flow preservation coverage
- a bounced order confirmation email surfaces in the admin and can be resent without duplicating side effects — foundation shipped with real-DB resend/provider-transition coverage

## Phase 5 - Setup Wizard, CLI, And Launch Operations

Status: active foundation with `doopify doctor`, setup status API, Setup tab, interactive `doopify setup`, and deployment automation commands shipped

See `SETUP_AND_CLI_PLAN.md`.

### Goals

- add `doopify doctor` for read-only local setup diagnostics — shipped
- add setup status service and `/api/setup/status` — shipped
- add Settings -> Setup checklist tab — shipped foundation
- add interactive `doopify setup` — shipped foundation
- add optional deployment automation commands: `doopify env push`, `doopify stripe webhook`, `doopify db check`, `doopify deploy` — shipped foundation
- later harden non-interactive/dry-run and deeper provider provisioning flows
- keep sensitive provider tokens out of long-lived app storage unless scoped lifecycle is designed

### Acceptance Checks

- `doopify doctor` identifies missing setup pieces and exits non-zero for required failures
- Settings -> Setup shows setup health without running shell commands from the browser
- `doopify setup` can generate/update local env, run database setup, and bootstrap owner/store
- setup automation redacts secrets and never commits generated secrets
- setup checks are testable and reusable between CLI and app status API

## Phase 6 - Production Hardening And Launch Readiness

Status: foundation shipped; continue operational hardening

### Goals

- enforce CI verification on every push and pull request
- document repeatable production deployment steps
- document backup/restore and rollback/recovery paths
- document provider and environment setup for Neon, Stripe, and Resend
- document admin account recovery for credential/access incidents

### Shipped Foundation

- `.github/workflows/ci.yml` for push/PR verification:
  - `npm ci`
  - `npm run db:generate`
  - `npx tsc --noEmit`
  - `npm run test`
  - `npm run build`
- `.github/workflows/integration.yml` optional integration workflow (`npm run test:integration`) gated by `DATABASE_URL_TEST` secret
- production runbook pack:
  - `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
  - `ENVIRONMENT_VARIABLE_REFERENCE.md`
  - `WEBHOOK_CONFIGURATION_GUIDE.md`
  - `STRIPE_SETUP_GUIDE.md`
  - `RESEND_SETUP_GUIDE.md`
  - `NEON_SETUP_GUIDE.md`
  - `BACKUP_AND_RESTORE.md`
  - `ADMIN_USER_RECOVERY_GUIDE.md`

### Next Hardening

- add non-interactive runbook validation scripts
- add periodic restore drills and incident rehearsal cadence
- expand runbooks as integration/event surfaces grow

## Phase 7 - Platform Extraction

Status: deferred until after Phase 4 and setup/deployment foundations are stable

### Goals

- extract shared domain and service logic into versioned internal packages
- introduce a thin SDK that lets external consumers call commerce services
- add a scaffolder CLI or template tool for new resources
- keep the main app as the proving ground until extraction is justified by real reuse

## Phase 8 - Public Plugin Platform

Status: deferred until after platform extraction proves out

### Requirements Before We Market This

- versioned plugin manifest
- stable supported event contract
- settings schema and admin surfaces for integrations
- compatibility and upgrade rules
- retry and observability story for failed handlers
- clear isolation model and ownership boundaries

## Verification And Testing

Validated locally by the maintainer on April 28, 2026 after the Phase 4 transactional email observability and real-DB confidence pass:

```bash
npm run test:integration
npm run test
npm run build
```

Recommended full verification before release claims:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

`npm run test:integration` should be run with a disposable Postgres database/schema before making release claims about real-DB behavior.

Next automated coverage priorities:

- transactional email delivery status transitions
- safe email resend without duplicate commerce side effects
- outbound webhook real-DB retry/idempotency
- integration secret encryption at rest
- setup status derivation and CLI doctor checks

## Marketing Positioning

Near-term marketing should emphasize:

- developer-first commerce engine
- self-hostable app foundation
- real admin plus real storefront
- Stripe-backed checkout architecture
- collections and merchandising powered by the same app developers extend
- typed server-side extension seams
- observable lifecycle operations: refunds, returns, inbound webhooks, and outbound webhooks
- Prisma and Postgres at the core

Near-term marketing should not emphasize:

- plugin marketplace
- schema-generated admin
- multi-tenant platform
- theme marketplace
- one-click deployment claims before the Setup Wizard and CLI are implemented and verified
