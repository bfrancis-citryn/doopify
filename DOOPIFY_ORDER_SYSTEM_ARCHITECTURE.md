# Doopify Order System Architecture

## Goal

Run the storefront, admin, and future customer-facing flows on one shared commerce core so catalog, orders, inventory, and media stay in sync.

## Architecture Direction

The app should continue using one persistence and service layer for:

- admin operations
- storefront reads
- checkout and payment orchestration
- future customer account pages

Current shared core building blocks already live in the repo:

- Prisma schema for products, variants, media, customers, orders, payments, fulfillments, refunds, returns, and sessions
- service-layer modules for auth, products, orders, customers, discounts, analytics, and settings
- protected admin pages through `src/proxy.ts`
- public storefront product APIs at `/api/storefront/products` and `/api/storefront/products/[handle]`

## What Is Implemented Today

### Admin order flow

Admin can already:

1. open `/orders`
2. drill into `/orders/[orderNumber]`
3. inspect line items, customer data, payment state, and addresses
4. update order status
5. create fulfillment records
6. read order events generated from persisted data

### Catalog to storefront flow

The catalog side of the architecture is working now:

1. staff edits a product in admin
2. product, variant, option, and media changes persist through Prisma
3. storefront product APIs revalidate
4. `/shop` and `/shop/[handle]` reflect the updated catalog

### Media architecture

Media now participates in the shared commerce core instead of existing as UI-only state:

- `MediaAsset` stores the asset record
- `ProductMedia` links assets to products
- `/media` provides a dedicated admin library
- alt text can be edited centrally and reused wherever the asset is linked

## Order Identity Strategy

Keep both:

- `id` for internal relations
- `orderNumber` for URLs and operator/customer-facing UI

Admin detail route:

- `/orders/1005`

UI label:

- `#1005`

## Current Gaps In The Order Architecture

The order model is in place, but the full commerce loop is not finished yet.

### Missing purchase creation path

The biggest missing piece is the storefront-to-order handoff:

- no real `/checkout` page
- no Stripe PaymentIntent flow
- no webhook-driven order creation
- no customer payment success/failure lifecycle

### Missing draft-order persistence

Draft orders still need:

- database persistence
- pricing/inventory validation against real products
- conversion from draft order to final order

### Missing post-purchase customer loop

- customer account order history
- customer-visible tracking
- email notifications
- refund and return UI workflows

## Recommended Next Implementation Order

1. Build Stripe checkout creation and webhook handling.
2. Create orders from webhook success using the existing order service layer.
3. Atomically decrement inventory during checkout finalization.
4. Send transactional email after payment success.
5. Persist draft orders once the live purchase path is stable.
6. Add customer order history and post-purchase visibility.

## Repo Organization

- `prisma/schema.prisma` -> source of truth for order and catalog persistence
- `src/server/services/order.service.ts` -> order domain logic
- `src/app/api/orders/*` -> admin-facing order routes
- `src/app/api/storefront/products/*` -> publishable storefront catalog reads
- `src/proxy.ts` -> admin/private route protection

