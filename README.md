# Doopify

Doopify is a developer-first commerce app built with Next.js 16, Prisma, and PostgreSQL. It ships a shared admin and storefront, a Stripe-backed checkout flow, and typed server-side extension seams for first-party integrations.

## Current Status

### Working now

- Protected admin auth with session-backed JWT validation
- DB-backed products, variants, media, customers, discounts, settings, analytics, and orders
- Storefront catalog routes at `/`, `/shop`, and `/shop/[handle]`
- Collection browsing at `/collections` and `/collections/[handle]`
- Checkout flow at `/checkout` with `POST /api/checkout/create`
- Verified Stripe webhook handling at `POST /api/webhooks/stripe`
- Checkout status reconciliation at `GET /api/checkout/status`
- Idempotent paid-order creation and inventory decrement on verified payment success
- Typed internal event dispatch plus first-party confirmation email handling
- Admin collection management at `/admin/collections`

### Active phase

The current active product phase is **Phase 3: Merchant Readiness And Storefront Differentiation**.

Current priorities:

- collections admin CRUD and storefront browsing
- stronger merchandising on the storefront
- checkout pricing hardening for discounts, shipping, and tax handling
- automated coverage for the revenue path
- launch and marketing proof points for the developer-first story

## Active Planning Docs

- [features-roadmap.md](./features-roadmap.md) - the single source of truth for product phases and priorities
- [HARDENING.md](./HARDENING.md) - security, trust, correctness, and production-readiness work
- [docs/phase-3-kickoff.md](./docs/phase-3-kickoff.md) - the execution brief for the active Phase 3 workstream
- [docs/launch-rollout.md](./docs/launch-rollout.md) - launch positioning, claims, and marketing rollout notes
- [docs/archive/README.md](./docs/archive/README.md) - historical planning docs that were removed from the active root workflow

## Key Routes

### Admin pages

- `/orders`
- `/admin/collections`
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
- `/api/checkout/create`
- `/api/checkout/status`
- `/api/webhooks/stripe`

## Development

Run the app locally:

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
```

## Database And Environment

This repo expects PostgreSQL through Prisma.

- Put `DATABASE_URL` and `DIRECT_URL` in `.env`
- Put app/runtime secrets in `.env.local`

Common commands:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run db:seed:bootstrap
```

## Notes On Media

Media is currently stored in Postgres through `MediaAsset.data` and served by `/api/media/[assetId]`.

That is fine for local development and current admin workflows. Moving to object storage or a CDN-backed image service remains a later production-readiness task.
