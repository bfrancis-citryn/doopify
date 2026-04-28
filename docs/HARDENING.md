# Doopify Hardening Status

> Security, correctness, and operational readiness for the commerce loop.
>
> Documentation refresh: April 27, 2026
> Last repo verification recorded in active docs: April 27, 2026
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
- unpublished collections are excluded from storefront collection reads

### Order And Checkout Correctness

- order totals are recomputed server-side
- checkout pricing now flows through `src/server/checkout/pricing.ts`
- checkout validates live variant pricing and inventory before creating the payment intent
- orders are created only from verified Stripe webhook success
- duplicate webhook deliveries are handled idempotently through the payment-intent path, including recovery when a race surfaces as a non-unique transaction error
- checkout failure state is persisted and surfaced on the success-page polling flow
- checkout-native code discounts are calculated through the server pricing authority
- checkout pricing now applies baseline destination-aware shipping zone rates and tax rules server-side
- checkout pricing now reads settings-backed domestic/international shipping and tax rates from Store settings
- checkout pricing now resolves persisted shipping-zone/rate and jurisdiction tax-rule configuration from admin-managed settings
- checkout payload snapshots now persist shipping/tax resolution decisions for historical accuracy after config changes
- discount applications and usage counts are persisted only after verified paid order creation succeeds
- Stripe webhook deliveries are durably logged with provider event id, type, status, attempts, processed timestamp, last error, payload hash, verified local payload storage, and retry metadata
- webhook replay now uses the verified local payload instead of refetching from Stripe, and retry/support diagnostics are available through admin API/UI on top of the durable delivery log
- fast automated tests cover checkout pricing, discount-code math and invalid states, checkout creation, checkout payload validation failures, checkout inventory-exhaustion rejection, duplicate payment-intent completion, and invalid webhook signature rejection
- fast automated tests cover verified webhook payload capture, non-retryable signature/malformed-payload handling, retry scheduling/exhaustion, cron retry authorization, local-payload replay, and support diagnostics
- fast automated tests now cover representative shipping-zone/rate and jurisdiction tax-resolution matrix behavior
- `npm run test:integration` runs successfully when `DATABASE_URL_TEST` points at a disposable Postgres database or schema
- gated real-DB integration specs cover paid checkout inventory decrement, duplicate payment-intent idempotency, competing duplicate completions, insufficient-stock consistency, paid-only/idempotent discount application usage, concurrent checkout creation near stock-out, conflicting success/failure webhook delivery for one payment intent, paid-order finalization while email delivery fails, concurrent discount usage-cap enforcement, late payment-success webhook delivery against expired sessions, and stored-payload webhook retry idempotency
- the real-DB run exposed and fixed a concurrent checkout customer-creation race; checkout customer creation must stay idempotent under concurrent payment-intent completion
- late or conflicting failure webhooks cannot downgrade a completed paid checkout session
- capped discounts now enforce usage limits transaction-safely under concurrent paid-order finalization

### Internal Extensibility Without Premature Plugin Complexity

- typed internal events are in place
- event handlers execute through a static registry instead of a runtime filesystem loader
- order confirmation email is driven from the `order.paid` event

## Verified

The repo passed these checks on April 27, 2026 (Phase 3 complete, Phase 4 kickoff):

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

`npm run test:integration` should be run with a disposable Postgres database/schema before making release claims about real-DB behavior.

### Closed In Phase 3E

- Shared rate-limit store replaced the in-memory limiter; the interface allows test stubbing and is suitable for multi-instance deployment
- Production Postgres SSL normalized to `sslmode=verify-full` and documented in `README.md`
- Tests prove collection mutation routes reject non-admin sessions
- Audit logging for settings changes, payment events, and fulfillment operations shipped in Phase 3C

## Remaining Hardening Work

### High Priority

- Expand automated tests for deeper checkout validation failures and broader real-DB race-condition coverage as Phase 4 refund/return/outbound-webhook behaviors land
- Keep the centralized pricing authority on the server as Phase 4 refund and return flows touch payment records
- Ensure Phase 4 outbound webhook delivery signing and retry logic maintains invariants from the existing inbound webhook hardening target

### Medium Priority

- Extract the remaining business logic that still lives in route handlers, especially analytics, discounts, and media administration paths
- Keep collection assignment and merchandising APIs admin-only while storefront collection reads stay public and read-only

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
- checkout customer creation is idempotent when duplicate payment-intent completions race
- conflicting Stripe success/failure deliveries for one payment intent must not downgrade paid checkout state
- inventory decrement happens only after verified payment success
- discount applications and usage increments happen only after verified paid order creation
- capped discount usage is enforced safely under concurrent paid-order finalization
- late payment-success webhook delivery can finalize an expired checkout session exactly once
- order/payment/inventory commits remain durable even when order confirmation email delivery fails
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
- zone/rate resolution precedence
- jurisdiction override precedence

Rules:

- use integer minor units for money
- never trust client-submitted totals
- persist enough snapshot data to keep historical order truth accurate
- persist shipping/tax resolution decisions with checkout snapshots
- keep browser display logic separate from server pricing authority

## Inventory Hardening Target

Inventory changes should be transaction-safe.

The service should prove:

- successful payment can decrement inventory
- duplicate webhook delivery does not double-decrement
- competing purchases cannot push stock negative
- concurrent checkout creation near stock-out still keeps paid-order inventory deterministic
- insufficient stock fails clearly
- order/payment state remains consistent if inventory mutation fails

## Webhook Hardening Target

Webhook operations should become observable and replayable.

Durable provider-event tracking now includes:

- provider
- provider event id
- event type
- status
- attempts
- processed timestamp
- last error
- payload hash
- verified local payload storage
- next retry timestamp
- last retry timestamp

This enables:

- duplicate detection
- safe replay
- safe automated retry without refetching provider events
- failed-email debugging
- duplicate-delivery debugging
- deterministic success/failure conflict handling for the same payment intent
- deterministic late-success handling for expired checkout sessions
- support/admin visibility

Retry rules:

- only verified, well-formed Stripe payloads are stored for retry/replay
- signature failures and malformed payloads are not retryable
- retry attempts use 1 minute, 5 minute, then 30 minute backoff
- deliveries are marked retry-exhausted after 4 total attempts
- `POST /api/webhook-retries/run` requires `WEBHOOK_RETRY_SECRET`

## Explicit Non-Goals

These ideas were intentionally rejected for this phase:

- creating Stripe PaymentIntents from `order.created`
- exposing Stripe under `/app/api/stripe/webhook/route.ts`
- adding a root-level `fs` plus `require()` plugin loader
- replacing the current admin with fully generated CRUD screens
- treating payment redirects as order finalization

## Operational Notes

- The correct public webhook endpoint is `POST /api/webhooks/stripe`
- The retry runner endpoint is `POST /api/webhook-retries/run` and must be called with `Authorization: Bearer WEBHOOK_RETRY_SECRET` or `x-webhook-retry-secret`
- The browser may start checkout, but only Stripe webhook success finalizes order creation
- Internal event handlers are allowed to fail without corrupting already-committed order or payment data
- Media binary storage in Postgres is acceptable for local/current workflows but should move to object storage before heavier production usage
- In-memory rate limiting must move to a shared store before multi-instance deployment

## Exit Criteria For The Next Hardening Pass

The next hardening milestone is complete when:

- checkout and webhook flows have broader automated coverage beyond the current real-DB inventory, discount, success/failure conflict, and expired-session late-webhook coverage
- new collection APIs are covered by DTO, publish-state, and auth expectations
- failed webhook deliveries can be replayed or retried safely from verified local payloads
- operational logging is good enough to debug a missing email, duplicate delivery, or stuck retry without inspecting the database manually
- production database SSL behavior is explicit and documented
