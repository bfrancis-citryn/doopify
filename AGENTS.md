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
