# Doopify Status

> Canonical status snapshot for developers, maintainers, and AI agents.
>
> Documentation refresh: April 26, 2026  
> Last repo verification recorded in active docs: April 26, 2026  
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
- Checkout validates inventory before creating payment intent
- Checkout session persistence
- Paid and failed status tracking
- Orders, payments, inventory decrements, and order events are created only after verified Stripe payment success
- Duplicate webhook deliveries are handled idempotently through the payment-intent path, including recovery when a race surfaces as a non-unique transaction error
- Discount applications and discount usage counts are created only after verified paid order creation succeeds
- Stripe webhook deliveries are durably logged with provider event id, type, status, attempts, processed timestamp, last error, and payload hash
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
- Collection publish/unpublish semantics are backed by Prisma and storefront filtering
- Fast automated tests cover checkout pricing, shipping/tax zone behavior, checkout-native discount math, checkout creation, checkout discount-code input handling, checkout payload validation failure handling, checkout inventory-exhaustion rejection, duplicate payment-intent completion, invalid webhook signatures, webhook delivery logging behavior, admin collection mutations, storefront collection routes, and storefront-safe collection DTOs
- `npm run test:integration` executes successfully when `DATABASE_URL_TEST` points at a disposable Postgres database or schema
- Gated real-DB integration specs cover paid checkout inventory decrement, duplicate payment-intent idempotency, competing duplicate completions, insufficient-stock consistency, and paid-only/idempotent discount application usage
- The real-DB run exposed and fixed a concurrent checkout customer-creation race; customer creation during payment-intent completion must stay idempotent

### Phase 3 Current Priorities

1. Expand broader real-DB race/idempotency checks beyond duplicate payment-intent completion
2. Refine shipping and tax rules from baseline defaults into configurable merchant-grade behavior
3. Add webhook replay/admin visibility tooling on top of the new durable delivery log
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

- Expanded automated tests for checkout validation failures beyond payload-schema checks
- Broader real-DB race-condition coverage beyond duplicate payment-intent completion
- Deeper collection coverage for assignment edge cases and mutation performance behavior
- Configurable shipping zones and rates beyond baseline defaults
- More complete jurisdiction-aware tax logic
- Discount-code UX on storefront checkout surfaces, including stale-cart and rejected-code messaging

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

- Expand automated tests for deeper checkout validation failures plus real-DB race-condition behavior beyond the current duplicate payment-intent coverage
- Keep the centralized pricing authority on the server as discounts, shipping logic, and tax handling evolve
- Add automated checks for collection CRUD, admin-only collection mutations, and collection mutation performance regressions
- Move rate limiting from in-memory process state to a shared store before multi-instance deployment
- Review and normalize production Postgres SSL settings so environments explicitly use `sslmode=verify-full`

### Medium Priority

- Extract remaining business logic that still lives in route handlers, especially analytics, discounts, and media administration paths
- Keep collection assignment and merchandising APIs admin-only
- Keep storefront collection reads public and read-only
- Add webhook replay tooling and support-facing visibility on top of the durable delivery log
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

Validated in this repo on April 26, 2026:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run test:integration # with DATABASE_URL_TEST configured to a disposable Postgres database/schema
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
