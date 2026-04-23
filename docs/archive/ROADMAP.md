> Archived on April 22, 2026.
> Historical reference only. Use `features-roadmap.md` for the active product plan.

# Doopify Roadmap

> Last updated: April 20, 2026

This roadmap reflects the current repo state after the admin redesign, Prisma/Neon data wiring, storefront product sync work, and the new standalone media library.

## Current Snapshot

| Area | Status | Notes |
|------|--------|-------|
| Admin shell and UI | Done | Obsidian glass theme across the admin shell with dedicated routes for orders, products, customers, discounts, analytics, settings, draft orders, and media |
| Auth and route protection | Mostly done | Login/logout/me routes exist and `src/proxy.ts` protects admin pages and private APIs with the `doopify_token` cookie |
| Database and Prisma | Done | Prisma schema, client generation, Postgres adapter, seed paths, and DB-backed services are in place |
| Products and media | Done | Product CRUD, variant CRUD, product option syncing, storefront publishing, media uploads, media linking, and alt text editing are working |
| Storefront catalog | Partial | `/`, `/shop`, and `/shop/[handle]` render real catalog data; cart drawer exists; checkout is not connected yet |
| Orders and operations | Partial | Orders, statuses, fulfillments, analytics, customers, discounts, and settings are DB-backed; draft orders remain UI-first |
| Payments and checkout | Not started | No live Stripe checkout, payment intent flow, or webhook-based order creation yet |
| Notifications and accounts | Not started | No transactional email flow or customer account portal yet |
| Launch hardening | Partial | Build passes, but role-based auth, rate limiting, SEO hardening, external media CDN strategy, and monitoring still need work |

## What Landed Recently

- Prisma/Postgres is now the real source of truth for products, orders, customers, discounts, analytics, settings, auth sessions, and media assets.
- Admin auth is real: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, JWT cookie validation, and admin route protection are implemented.
- The product editor saves real product data again, supports optional variants, updates backend URLs while navigating, and syncs product changes to the storefront.
- Storefront product pages now read from live catalog data instead of mock-only state.
- Media moved from "UI only" to a working asset system backed by Prisma:
  - `/api/media`
  - `/api/media/upload`
  - `/api/media/[assetId]`
  - standalone `/media` admin workspace
  - upload, browse, alt text editing, delete, and product linkage visibility
- The admin UI was refit into the Obsidian glass visual system and no longer depends on light/dark mode switching.

## What Is Still In Progress

### Catalog and media

- Product catalog CRUD is real, but collection authoring and collection storefront routes are still missing.
- Media works from the database today, but the long-term storage decision is still open:
  - Current implementation stores binary assets in Postgres via Prisma.
  - We may still want external object storage or an image CDN later for production scale.

### Orders and operations

- Orders are persisted and admin order workflows exist.
- Draft orders still need a real persistence layer and conversion flow into completed orders.
- Refund and return models exist in Prisma, but the full admin workflows are not finished.

### Storefront

- The current storefront supports catalog browsing and product detail reads.
- Cart UI exists, but checkout is still placeholder-level.
- There is no collection browsing route, customer account area, or post-purchase account experience yet.

## Remaining Priorities

### 1. Checkout and payment flow

- Build `/checkout`
- Create PaymentIntent flow with Stripe
- Add webhook-driven order creation
- Revalidate inventory atomically during checkout
- Record payment events and order events from webhook success/failure

### 2. Draft order persistence

- Replace UI-only draft order state with DB-backed draft order records
- Connect draft orders to real customers, products, and pricing
- Add conversion flow from draft order to order

### 3. Collections and merchandising

- Add collection CRUD in admin
- Expose collection-aware storefront queries
- Build collection listing and detail pages
- Support featured collections on the storefront with real data

### 4. Security hardening

- Add role enforcement beyond "valid session exists"
- Add login rate limiting
- Review proxy coverage and private route assumptions
- Add stricter headers and production cookie/security checks

### 5. Notifications and customer-facing workflows

- Order confirmation email
- Fulfillment / shipping email
- Customer order history pages
- Customer authentication or magic-link account flow

### 6. Production readiness

- Decide on long-term media delivery strategy
- Add monitoring and error reporting
- Improve storefront SEO metadata and sitemap generation
- Add mobile QA and launch smoke-test checklist

## Phase View

| Phase | Status | Scope |
|------|--------|-------|
| Phase 1: Foundation | Done | Prisma, Postgres adapter, env split, TypeScript support, auth scaffolding |
| Phase 2: Admin APIs | Mostly done | Auth, products, customers, discounts, settings, analytics, orders, media |
| Phase 3: Admin data wiring | Mostly done | Core admin areas persist real data; draft orders still need backend persistence |
| Phase 4: Catalog publishing | Done | Product save, variant sync, storefront visibility, media linking |
| Phase 5: Storefront MVP | Partial | Homepage and shop pages exist; checkout and collections are still missing |
| Phase 6: Payments | Not started | Stripe checkout and webhooks |
| Phase 7: Customer lifecycle | Not started | Email, account portal, post-purchase customer views |
| Phase 8: Launch hardening | Partial | Build is healthy; production security and operations work remain |

## Recommended Next Sprint

Focus the next sprint on the first end-to-end purchase path:

1. Build Stripe checkout creation and webhook handling.
2. Create orders from storefront purchases instead of admin-only flows.
3. Add inventory protection at checkout time.
4. Send order confirmation email after webhook success.
5. Backfill draft order persistence once the purchase path is stable.

## Definition Of Done

A feature is done when:

- it works end-to-end from DB to API to UI
- it survives refresh and route navigation
- it returns the standard `{ success, data, error }` contract
- it uses Prisma as the only persistence layer
- it includes enough validation to prevent obviously broken writes
