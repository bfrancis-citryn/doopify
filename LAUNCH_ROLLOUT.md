# Doopify Launch Rollout

> Positioning and rollout guide for the developer-first, self-hostable commerce story.
>
> Documentation refresh: April 25, 2026

## Core Positioning

Doopify is a developer-first, self-hostable commerce engine built with Next.js, Prisma, PostgreSQL, and Stripe.

It gives developers:

- a real admin
- a real storefront
- Prisma/Postgres as the source of truth
- server-owned checkout logic
- Stripe-backed payment architecture
- verified webhook order finalization
- typed server-side extension seams
- a path to customize commerce without starting from scratch

## The Cleanest Launch Line

> A developer-first, self-hostable commerce engine with a real admin, real storefront, Prisma/Postgres at the core, Stripe-backed checkout, and typed server-side extension seams.

## What To Show In Demos

### Demo Path 1 - Merchant Creates Storefront Structure

1. Log in to admin
2. Create or edit products
3. Upload media
4. Create a collection
5. Assign products to the collection
6. Visit `/collections`
7. Open `/collections/[handle]`
8. Show homepage/shop merchandising using collection data

Proof point:

- The admin and storefront use the same DB-backed commerce model.

### Demo Path 2 - Checkout Trust Path

1. Add products to cart
2. Start checkout at `/checkout`
3. Create a live-priced checkout session
4. Complete payment through Stripe test flow
5. Let the verified webhook finalize order creation
6. Show order status reconciliation
7. Show inventory decrement and order record

Proof point:

- Browser redirects do not create orders. Verified payment success does.

### Demo Path 3 - Developer Extension Path

1. Show typed event map
2. Show server-only dispatcher
3. Show static integration registry
4. Show order confirmation email consumer
5. Show where outbound webhooks/audit logs can plug in next

Proof point:

- Doopify is extendable without pretending a public plugin marketplace is already complete.

## Strong Claims

Use these:

- Developer-first commerce engine
- Self-hostable commerce foundation
- Real admin plus real storefront
- Prisma/Postgres-backed source of truth
- Stripe-backed checkout architecture
- Verified webhook order finalization
- Typed server-side extension seams
- Collection-driven merchandising
- Built to be extended by developers

## Claims To Avoid For Now

Avoid these until they are actually built, tested, and documented:

- plugin marketplace
- theme marketplace
- multi-tenant SaaS
- complete Shopify replacement
- enterprise tax automation
- generated admin platform
- arbitrary third-party plugin runtime
- production-scale CDN media pipeline

## Audience

### Primary Audience

Developers who want:

- ownership over their commerce stack
- a real starting point instead of a toy starter
- Prisma/Postgres as an understandable data layer
- Stripe checkout they can inspect and customize
- server-side extension seams
- a self-hostable path

### Secondary Audience

Founders and technical merchants who want:

- a customizable commerce base
- less lock-in
- a product they can adapt
- a clear path from simple store to custom workflows

## Message Pillars

### 1. Own The Stack

You can inspect, modify, and deploy the commerce engine yourself.

### 2. Real Commerce Loop

Admin, storefront, checkout, webhooks, orders, and inventory are connected through the same app.

### 3. Built For Developers

The system favors explicit services, typed events, Prisma models, and clear route boundaries.

### 4. Extend Before Marketplace

Doopify has typed server-side extension seams now. Public plugin platform later.

### 5. Self-Hostable First

No hidden hosted control plane is required for the core app.

## Launch Readiness Checklist

Before making larger public claims:

- [ ] Collections are demoable end-to-end
- [ ] Checkout test path is reliable
- [ ] Webhook order creation is demonstrable
- [ ] Inventory decrement is visible
- [ ] Confirmation email flow is demonstrable or clearly labeled as first-party event consumer
- [ ] Checkout/webhook/inventory path has automated coverage
- [ ] README accurately matches current behavior
- [ ] `STATUS.md`, `features-roadmap.md`, and `HARDENING.md` are up to date
- [ ] Known gaps are called out honestly

## Suggested README Badge/Tagline Copy

```md
Developer-first commerce engine with a real admin, real storefront, Prisma/Postgres source of truth, Stripe-backed checkout, and typed server-side extension seams.
```

## Suggested Short Product Description

```md
Doopify is a self-hostable commerce engine for developers who want a real admin, a real storefront, and a customizable server-side commerce stack. It uses Next.js, Prisma, PostgreSQL, and Stripe, with verified webhook order finalization and typed internal events for integrations.
```

## Suggested Social Copy

```txt
Building Doopify: a developer-first, self-hostable commerce engine.

Real admin.
Real storefront.
Prisma/Postgres source of truth.
Stripe-backed checkout.
Typed server-side extension seams.

Not a toy starter. Not a black box.
```
