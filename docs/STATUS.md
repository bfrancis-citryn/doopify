# Doopify Status

> Canonical status snapshot for developers, maintainers, and AI agents.
>
> Documentation refresh: April 29, 2026
> Last repo verification recorded in active docs: April 29, 2026
> Current active phase: **Phase 4 - Merchant Lifecycle And Outbound Integrations**

## Why This File Exists

This file prevents context loss when someone returns to the repo later.

Doopify previously had multiple planning files with conflicting status. The active state is consolidated here, while product sequencing lives in `features-roadmap.md` and security/operational work lives in `HARDENING.md`.

## Product Identity

Doopify is a developer-first, self-hostable commerce engine with:

- a real protected admin
- a real storefront
- Prisma as the commerce source of truth
- PostgreSQL persistence
- Stripe-backed checkout architecture
- verified webhook order finalization
- typed server-side extension seams
- a static integration registry before any public plugin platform

## Current Repo Truth

Doopify is a real DB-backed commerce app, not a prototype.

The repo currently includes:

- Prisma/Postgres commerce schema for products, variants, media, customers, orders, discounts, settings, sessions, payments, fulfillments, refunds, returns, integrations, inbound webhook deliveries, outbound webhook deliveries, and email deliveries
- persisted commerce money fields now use integer minor units (cents) at rest with server-side conversion boundaries
- Next.js App Router admin, storefront, and API surface
- protected admin auth with session-backed JWT validation
- private route protection through `src/proxy.ts`
- route-level authorization helpers (`requireAuth`, `requireAdmin`, `requireOwner`, `requireRole`) applied across sensitive admin mutation and observability APIs as an inner authorization guard
- public storefront routes for homepage, shop, product detail, collections, and collection detail
- Stripe checkout creation, Stripe webhook processing, checkout status polling, checkout session persistence, and idempotent paid-order finalization
- inventory decrement only after verified Stripe payment success
- centralized checkout pricing in `src/server/checkout/pricing.ts`
- checkout-native discount-code validation and paid-order discount usage persistence
- settings-backed shipping/tax rates plus persisted shipping zones/rates and jurisdiction-aware tax rules
- shipping settings Phase 1 foundation with shipping mode/manual-rate API (`GET/PATCH /api/settings/shipping`) and admin workspace at `/admin/settings/shipping`
- DB-backed admin APIs for products, orders, customers, discounts, analytics, settings, media, collections, shipping zones, tax rules, integrations, inbound webhook deliveries, outbound webhook deliveries, and email deliveries
- durable inbound Stripe webhook delivery logging with verified local payload storage, replay, retry scheduling/exhaustion, diagnostics, and admin visibility at `/admin/webhooks`
- typed internal event dispatcher and static integration registry
- first-party logging and order-confirmation email consumers
- Phase 4 refund service with pending refund persistence, Stripe idempotency keys, payment/order status updates, validated item-level restocking, and return linkage
- Phase 4 return service with state-machine transitions, order-owned item validation, received-return close-with-refund support, and admin order action panels
- Phase 4 outbound merchant webhook foundation with subscriptions, timestamped HMAC signatures, retry/backoff, manual retry API, dead-letter/exhausted visibility, integration settings UI, and admin delivery visibility
- Phase 4 correctness hardening for outbound webhook delivery claiming, manual retry eligibility, integration secret preservation, event-subscription deduplication, and return refund quantity validation
- Phase 4 transactional email observability foundation with `EmailDelivery` persistence, provider adapter seam, order-confirmation delivery tracking, and fast service tests
- Phase 4 analytics event fan-out foundation with typed lifecycle events, `AnalyticsEvent` persistence, and side-effect-safe consumer handling
- Phase 4 background side-effect job foundation with persisted `Job` records, claiming, retry/backoff/exhaustion lifecycle, secure runner route, and initial order-confirmation email job integration
- Phase 4 abandoned checkout recovery foundation with persisted recovery metadata, admin review/send controls, safe tokenized recovery payload API, and secret-protected due-send processing
- Brand Kit foundation with Store-backed branding fields, admin Brand Kit screen/API, safe public brand payloads, and branded checkout/email defaults
- GitHub Actions CI workflow for push/PR verification plus optional integration workflow gated by `DATABASE_URL_TEST` secret
- production runbook docs for deployment checklist, environment variables, webhooks/provider setup, backup/restore, and admin recovery
- Vitest fast test harness plus `DATABASE_URL_TEST`-gated real-DB integration specs

## Phase 3 Status

Phase 3 is complete.

Shipped Phase 3 scope includes:

- collection service layer and storefront-safe DTOs
- admin collection APIs and `/admin/collections`
- storefront collection APIs and `/collections` routes
- collection publish/unpublish semantics
- collection merchandising surfaces on homepage/shop
- checkout pricing hardening for discounts, shipping, tax, zone/rate resolution, jurisdiction rules, and checkout snapshots
- private admin CRUD for shipping zones/rates and tax rules
- durable inbound Stripe webhook replay/retry/diagnostics/admin visibility
- shared rate-limit store, production Postgres SSL normalization, and audit logging for settings/payment/fulfillment operations
- fast tests and gated real-DB integration tests for the revenue path, inventory, discount usage caps, webhook conflicts, retry idempotency, and concurrency behavior

## Active Phase 4 Scope

Phase 4 is active now.

### Shipped Phase 4 Foundations

#### Refunds And Returns

Shipped:

- admin refund panel on order detail
- admin return creation panel on order detail
- admin return workflow controls for approve, decline, mark in transit, mark received, and close with refund
- refund service creates a `PENDING` refund before calling Stripe
- Stripe refund calls use deterministic idempotency keys
- failed Stripe refund attempts mark the refund `FAILED` without mutating order/payment/inventory state
- issued refunds update payment and order payment status
- item-level refund validation checks order ownership, variant match, and refundable quantity
- restocking occurs only after Stripe refund success
- returns validate order-owned items and follow the `REQUESTED -> APPROVED -> IN_TRANSIT -> RECEIVED -> CLOSED` state machine
- received returns can close with a linked refund
- close-with-refund now validates refund quantities and variants against the actual returned items
- fast tests cover refund/return services and API behavior
- gated integration coverage was added for partial/full refund, restocking, Stripe failure, return state transitions, and return-to-refund linkage

#### Outbound Merchant Webhooks

Shipped:

- `Integration`, `IntegrationEvent`, `IntegrationSecret`, and `OutboundWebhookDelivery` Prisma-backed models
- settings APIs for creating/updating/deleting integrations with encrypted webhook secrets and custom header secrets
- integration edits preserve existing signing secrets unless explicitly cleared
- event subscriptions are deduplicated and constrained unique per integration/event
- `queueOutboundWebhooks()` service for creating outbound delivery records from typed internal events
- `processOutboundWebhook()` service for signed delivery, response recording, backoff, retrying, and exhausted/dead-letter state
- delivery claiming before outbound sends to reduce duplicate overlapping cron delivery
- manual retry eligibility checks for missing, successful, and non-retryable deliveries
- timestamped HMAC signatures in the `sha256=<hex>` format
- delivery headers: `X-Doopify-Delivery`, `X-Doopify-Event`, `X-Doopify-Timestamp`, and `X-Doopify-Signature`
- custom encrypted outbound headers using `IntegrationSecret` keys prefixed with `HEADER_`
- `processDueOutboundDeliveries()` used by the existing cron-compatible retry runner
- `POST /api/outbound-webhook-deliveries/[id]/retry` for manual retry
- hardened `GET /api/outbound-webhook-deliveries` listing API with status validation
- `/settings` integration panel for creating/editing webhook subscriptions, selected events, active/inactive state, signing secret, and encrypted custom headers
- `/admin/webhooks` inbound/outbound direction switch, outbound delivery table, status filter, response/attempt visibility, and manual retry button
- fast tests for outbound service queueing, signing, delivery success, retry/exhaustion, due processing, manual retry, listing route, and retry route

#### Transactional Email Observability

Shipped foundation:

- `EmailDeliveryStatus` enum and `EmailDelivery` Prisma model
- provider adapter seam in `src/server/email/provider.ts`
- email delivery service in `src/server/services/email-delivery.service.ts`
- tracked send flow with `PENDING -> SENT` and `PENDING -> FAILED` persistence
- order-confirmation email delivery now creates delivery records and stores provider metadata when available
- private email delivery APIs: `GET /api/email-deliveries`, `GET /api/email-deliveries/[id]`, `POST /api/email-deliveries/[id]/resend`
- safe resend policy for `FAILED`/`BOUNCED`/`COMPLAINED` order-confirmation deliveries that creates a new tracked send without re-emitting commerce side effects
- admin email delivery visibility in `/admin/webhooks` with status filters, detail inspection, resend controls, and pagination
- provider webhook route at `POST /api/webhooks/email-provider` with Svix signature verification and bounced/complained status transitions
- `DATABASE_URL_TEST`-gated integration specs added for safe resend audit-trail behavior and provider bounce/complaint state transitions
- `DATABASE_URL_TEST` real-DB execution now verifies resend side-effect safety, provider bounce/complaint transitions, outbound webhook retry/idempotency behavior, and integration-secret preservation update flows
- fast tests for delivery creation, sent/failed transitions, tracked send success/failure, paginated delivery listing, email delivery API/resend behavior, and provider webhook route behavior

Ongoing expansion:

- broaden real-DB lifecycle coverage as lifecycle consumers and race paths expand

#### Analytics Event Fan-Out

Shipped foundation:

- `AnalyticsEvent` Prisma model for durable server-side lifecycle analytics
- typed analytics lifecycle events for checkout, order, refund, return, email, and webhook outcomes
- analytics consumer registered in the existing internal event registry
- checkout/refund/return/email/webhook services now emit analytics lifecycle events from server-owned flows
- analytics failures are isolated from commerce durability through handler failure containment

#### Abandoned Checkout Recovery

Shipped foundation:

- recovery lifecycle metadata persisted on `CheckoutSession` (`abandonedAt`, `recoveryToken`, send counters/timestamps, `recoveredAt`)
- admin abandoned checkout APIs and workspace for list/detail, mark-due, due-send, and manual recovery sends
- secret-protected cron-compatible due-send route with summary counts
- token-protected checkout recovery API with server-side repricing and safe payload shaping
- checkout completion now marks recovery success only after verified paid completion when recovery outreach occurred

### Remaining Phase 4 Priorities

1. Setup Wizard and CLI hardening: expand deployment automation with safer non-interactive/dry-run paths and deeper provider provisioning
2. Production hardening and launch readiness: keep CI, deployment checklist, and recovery runbooks current as behavior changes
3. Continued audit-log expansion where admin lifecycle operations need durable traces
4. Broader real-DB lifecycle/race coverage as Phase 4 behavior expands

## Phase 4 Acceptance Checks

Status by acceptance check:

- Admin can issue a partial/full refund and order, payment, and inventory are consistent afterward — **foundation shipped; continue real-DB coverage**
- A return moves through its state machine and triggers a refund correctly — **foundation shipped; continue UX and integration coverage**
- Outbound webhook deliveries are signed, retried with backoff, and visible in the admin — **foundation shipped**
- Integration secrets never appear unencrypted at rest — **foundation shipped with real-DB update-flow preservation coverage**
- A bounced order confirmation email surfaces in the admin and can be resent without duplicating side effects — **foundation shipped with real-DB resend/provider-transition coverage**
- Lifecycle analytics events are emitted from server-owned flows and persisted without becoming a commerce-side dependency — **foundation shipped**
- Setup can be diagnosed with `doopify doctor`, verified from Settings -> Setup, and configured locally with `doopify setup` — **shipped foundation**
- Build and typecheck stay green throughout — **must be re-run after every change**

## Transactional Email Observability Plan

The current Phase 4 implementation slice is documented in:

```txt
TRANSACTIONAL_EMAIL_OBSERVABILITY_PLAN.md
```

First foundation shipped:

- durable `EmailDelivery` records
- email delivery service/provider adapter seam
- order confirmation delivery status tracking
- failed/sent delivery transitions
- private email delivery list/detail/resend APIs
- resend safety policy for failed/bounced/complained order-confirmation deliveries
- admin email delivery visibility in `/admin/webhooks`
- provider webhook handling for bounced/complained status transitions with signature verification

Remaining target:

- continue expanding lifecycle side-effect proofs and race/idempotency coverage

## Setup Wizard And CLI Plan

The planned setup/deployment automation sequence is documented in:

```txt
SETUP_AND_CLI_PLAN.md
```

Planned sequence:

- `doopify doctor` read-only local diagnostics — **shipped**
- setup status service and `/api/setup/status` — **shipped**
- Settings -> Setup checklist tab — **shipped foundation**
- interactive `doopify setup` — **shipped foundation**
- deployment automation commands (`doopify env push`, `doopify stripe webhook`, `doopify db check`, `doopify deploy`) — **shipped foundation**
- later deepen one-click provisioning and non-interactive/dry-run coverage

## Production Hardening And Launch Readiness

Production readiness foundation now includes:

- CI verification on every push/PR via `.github/workflows/ci.yml`
- optional integration workflow in `.github/workflows/integration.yml` (runs when `DATABASE_URL_TEST` secret is configured)
- production runbook docs:
  - `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
  - `ENVIRONMENT_VARIABLE_REFERENCE.md`
  - `WEBHOOK_CONFIGURATION_GUIDE.md`
  - `STRIPE_SETUP_GUIDE.md`
  - `RESEND_SETUP_GUIDE.md`
  - `NEON_SETUP_GUIDE.md`
  - `BACKUP_AND_RESTORE.md`
  - `ADMIN_USER_RECOVERY_GUIDE.md`

## Remaining Product Work

### Highest Priority

- Setup Wizard and CLI hardening (non-interactive/dry-run and deeper provider provisioning)
- Production hardening maintenance for CI, deployment runbooks, and recovery runbooks
- Broader real-DB race/idempotency coverage as Phase 4 behaviors expand

### Medium Priority

- Stronger admin-only mutation coverage for lifecycle operations
- More complete audit log consumers for integration changes, refunds, returns, email resends, and webhook retries
- Additional storefront/admin polish after lifecycle correctness is stable

### Later

- Extract shared domain and service logic into packages
- Introduce an SDK and lightweight CLI/template tooling
- Public plugin platform
- Plugin marketplace
- Full theme directory packaging
- Multi-tenant architecture

## Remaining Hardening Work

### High Priority

- Keep transactional email observability decoupled from order/payment/inventory durability as provider/event coverage expands
- Expand real-DB lifecycle coverage to include new event consumers and race paths
- Keep the centralized pricing authority server-owned as lifecycle flows evolve
- Continue proving payment, inventory, refund, return, webhook, and email behavior through real-DB tests where transaction behavior matters

### Medium Priority

- Extract remaining route-level business logic, especially analytics, discounts, and media administration paths
- Keep storefront reads public/read-only and admin mutation paths private
- Expand audit logging around lifecycle operations

### Later

- Move media binary storage off Postgres and into object storage
- Add customer-auth hardening when customer accounts exist
- Add broader CSP and response-header hardening once integration and asset origins are finalized

## Explicit Non-Goals Right Now

Do not market or build around these yet:

- public plugin marketplace positioning
- runtime `fs` plus `require()` plugin loading
- replacing the handcrafted admin with schema-generated CRUD UI
- multi-tenant architecture before the single-store flow is stable
- packaging full theme directories before branding tokens and reusable storefront components are settled
- running local shell commands from the browser Setup tab
- storing broad Vercel, Neon, or Stripe account tokens in the app before a scoped token lifecycle is designed

## Explicitly Rejected Technical Directions

- Creating Stripe PaymentIntents from `order.created`
- Exposing Stripe under `/app/api/stripe/webhook/route.ts`
- Adding a root-level runtime filesystem plugin loader
- Replacing the current admin with fully generated CRUD screens
- Treating browser redirects as payment truth

## Verification History

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

## Source Of Truth Rules

- `STATUS.md` tells you what is true now.
- `features-roadmap.md` tells you what to build next.
- `HARDENING.md` tells you what must become safer before production growth.
- `PROJECT_INTENT.md` tells you what Doopify is trying to become.
- `AGENTS.md` tells AI agents how to operate.
- Do not create another root-level roadmap that can drift from these files.
