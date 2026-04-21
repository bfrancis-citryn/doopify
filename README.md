# Doopify

Doopify is a headless commerce app built in Next.js 16 with a shared admin and storefront backed by Prisma and PostgreSQL.

The repo now includes a real persistence layer, protected admin routes, DB-backed product/catalog operations, storefront product reads, and a standalone media library for asset management.

## Current Product Status

### Working now

- Protected admin login flow with JWT cookie session checks
- Glassmorphism admin shell with route-based workspaces
- DB-backed products, variants, product options, media, customers, discounts, settings, analytics, and orders
- Storefront catalog pages at `/shop` and `/shop/[handle]`
- Product editor that saves real product data and syncs to the storefront
- Standalone media library at `/media`
  - upload images to Prisma/Postgres
  - reuse assets across products
  - edit alt text for SEO
  - delete assets
  - inspect linked products

### Still to build

- Stripe checkout and webhook-driven payment/order creation
- DB-backed draft order lifecycle
- Collections authoring and collection storefront routes
- Customer account portal
- Transactional email
- Role-based auth hardening and login rate limiting
- Production-grade media delivery strategy beyond DB-stored binaries

## Stack

- Next.js 16.2.2
- React 19
- Prisma 7
- PostgreSQL via `@prisma/adapter-pg`
- Zod
- bcryptjs
- jsonwebtoken

## Key Routes

### Admin pages

- `/orders`
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

### Core API routes

- `/api/auth/*`
- `/api/products`
- `/api/orders`
- `/api/customers`
- `/api/discounts`
- `/api/settings`
- `/api/analytics`
- `/api/media`
- `/api/storefront/products`

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

Media is currently stored directly in Postgres through the `MediaAsset.data` field and served by `/api/media/[assetId]`.

That works well for local development and functional admin workflows. For production scale, we may still want to move asset delivery to object storage or a CDN-backed image service later.

## Current Priority

The highest-value next step is turning the existing storefront catalog into a real purchase flow:

1. Stripe checkout creation
2. webhook-based order creation
3. inventory validation and decrement during checkout
4. confirmation email

