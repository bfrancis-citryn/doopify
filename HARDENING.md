# Doopify Hardening Status

> Last updated: April 22, 2026
> Companion to `features-roadmap.md`. This file tracks the trust and correctness work that now underpins checkout, Stripe webhooks, and internal integrations.

## Closed In This Pass

### Auth and session integrity

- `src/lib/env.ts` now validates critical environment variables up front
- JWT validation now checks the backing `Session` record, so logout and session revocation are real
- login is rate-limited by IP plus email
- shared cookie parsing now lives in `src/lib/cookies.ts` instead of ad hoc regexes

### Route protection

- `src/proxy.ts` now uses boundary-safe public-prefix matching
- admin and private API protection is running through the active Next.js 16 proxy hook
- the old idea of adding `src/middleware.ts` was intentionally not kept because Next 16 only allows one of `proxy.ts` or `middleware.ts`

### Media and public data safety

- SVG uploads are no longer accepted
- upload MIME is verified from file bytes instead of trusting the browser-reported type
- upload linking now verifies the target product before attaching media
- storefront product APIs now return explicit public DTOs instead of raw Prisma payloads
- public storefront settings are exposed through a safe read-only endpoint
- storefront collection APIs now split summary and detail payloads so list surfaces avoid nested product overfetching

### Order and checkout correctness

- order totals are recomputed server-side
- checkout validates live variant pricing and inventory before creating the payment intent
- orders are created only from verified Stripe webhook success
- duplicate webhook deliveries are handled idempotently through the payment intent path
- checkout failure state is persisted and surfaced on the success page polling flow

### Internal extensibility without premature plugin complexity

- typed internal events are in place
- event handlers execute through a static registry instead of a runtime filesystem loader
- order confirmation email is driven from the `order.paid` event

## Verified

The repo passed these checks on April 22, 2026:

- `npx prisma generate`
- `npx tsc --noEmit`
- `npm run build`

## Remaining Hardening Work

### High priority

- Add automated tests for checkout totals, webhook idempotency, invalid signatures, and inventory exhaustion
- Keep pricing authority on the server as discounts, shipping logic, and tax handling evolve in Phase 3
- Add automated checks for collection CRUD, storefront-safe collection DTO exposure, and collection mutation performance regressions
- Move rate limiting from in-memory process state to a shared store before multi-instance deployment
- Review and normalize production Postgres SSL settings so environments explicitly use `sslmode=verify-full`

### Medium priority

- Extract the remaining business logic that still lives in route handlers, especially analytics, discounts, and media administration paths
- Keep collection assignment and merchandising APIs admin-only while storefront collection reads stay public and read-only
- Add outbound webhook delivery logs, retries, and replay tooling
- Add stronger audit logging around settings changes, payment events, and fulfillment operations

### Later

- Move media binary storage off Postgres and into object storage
- Add customer-auth hardening when the customer account system exists
- Add broader CSP and response-header hardening once external integrations and asset origins are finalized

## Explicit Non-Goals

These ideas were intentionally rejected for this phase:

- creating Stripe PaymentIntents from `order.created`
- exposing Stripe under `/app/api/stripe/webhook/route.ts`
- adding a root-level `fs` plus `require()` plugin loader
- replacing the current admin with fully generated CRUD screens

## Operational Notes

- The correct public webhook endpoint is `POST /api/webhooks/stripe`
- The browser may start checkout, but only Stripe webhook success finalizes order creation
- Internal event handlers are allowed to fail without corrupting already-committed order or payment data

## Exit Criteria For The Next Hardening Pass

The next hardening milestone is complete when:

- checkout and webhook flows have automated coverage
- new collection APIs are covered by DTO and auth expectations
- failed webhook deliveries can be replayed safely
- operational logging is good enough to debug a missing email or duplicate delivery without inspecting the database manually
