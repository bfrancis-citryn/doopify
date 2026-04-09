# Doopify Order System Architecture

## Goal
Build Doopify as a real commerce system where the storefront website and admin app share one commerce core.

## Shared commerce core
Both surfaces should use the same database and domain logic:
- storefront website for shoppers
- admin for operators
- future customer account pages

## Storefront flow
1. Shopper browses products and variants.
2. Shopper adds items to cart.
3. Checkout validates inventory and pricing.
4. System creates a pending order.
5. Stripe payment intent is created and confirmed.
6. Payment + order statuses update.
7. Inventory is reduced.
8. Order events are written.
9. Order appears in admin immediately.

## Admin flow
1. Staff opens `/orders` list.
2. Staff opens `/orders/[orderNumber]` detail page.
3. Staff reviews line items, customer, payment, and addresses.
4. Staff creates fulfillment records and tracking.
5. Staff adds notes, tags, and events.
6. Staff processes refunds/returns.
7. Customer-visible status can later reflect those changes.

## Core entity map
- Store
- User
- Session
- Product
- ProductVariant
- Customer
- Order
- OrderItem
- OrderAddress
- Fulfillment
- FulfillmentItem
- Payment
- Refund
- Return
- ReturnItem
- OrderEvent
- MediaAsset
- ProductMedia

## Order identity strategy
Keep two identifiers:
- `id` for database relations
- `orderNumber` for URLs and UI

Use admin detail route:
- `/orders/1005`

Display in UI:
- `#1005`

## Recommended implementation order
1. Upgrade Prisma schema.
2. Add real order query layer in `src/lib/orders`.
3. Add bootstrap/seed data for local development.
4. Build DB-backed `/orders` + `/orders/[orderNumber]` queries.
5. Replace mock Orders context usage with DB-backed reads gradually.
6. Add checkout order creation and Stripe integration.

## Repo organization
- `src/lib/orders/*` → order domain logic
- `src/lib/checkout/*` → checkout orchestration
- `src/lib/payments/*` → Stripe payment flow
- `src/app/api/orders/*` → order route handlers
- `src/app/api/checkout/*` → checkout route handlers
- `prisma/schema.prisma` → source of truth for persistence
