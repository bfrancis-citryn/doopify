# Doopify Commerce Plan

## Goal
Turn Doopify into a real single-store commerce platform with one shared commerce core powering:
- a public storefront website
- a protected admin app
- future customer account/order history surfaces

The system should stop behaving like a design mock and start behaving like a real commerce product.

---

## Core architecture

### Shared commerce core
Both the storefront and admin should read/write the same source of truth.

#### Public storefront uses the core for
- product listing pages
- product detail pages
- cart
- checkout
- customer account order history

#### Admin uses the core for
- orders
- draft orders
- products
- media
- customers
- discounts
- analytics
- settings

That means we should not build separate fake data layers for storefront and admin. Both should sit on top of one real commerce data model.

---

## Data flow

### 1. Catalog flow
Admin creates or edits:
- products
- variants
- media
- pricing
- inventory

Storefront reads that data and renders:
- collection pages
- product pages
- availability
- pricing
- gallery images

### 2. Checkout flow
Customer on storefront:
1. browses products
2. adds variants to cart
3. starts checkout
4. payment is processed by Stripe
5. order is written to database
6. payment record is written to database
7. inventory is adjusted
8. order timeline/event entries are created
9. admin Orders page immediately reflects the new order

### 3. Fulfillment flow
Admin on Doopify:
1. opens order detail page
2. reviews payment / risk / customer / items
3. creates fulfillment
4. adds package, service, tracking
5. updates fulfillment state
6. timeline logs the event
7. future customer account page can reflect shipping status

### 4. Returns / refunds flow
Admin:
1. opens order detail page
2. creates return or refund records
3. returned items and refund amounts are written
4. payment/refund state is updated
5. customer/account and analytics can reflect that history

---

## Recommended route structure

### Admin routes
- `/orders`
- `/orders/[orderNumber]`
- `/draft-orders`
- `/products`
- `/products/[id]`
- `/media`
- `/customers`
- `/discounts`
- `/analytics`
- `/settings`

### Storefront routes
- `/`
- `/products/[handle]`
- `/collections/[handle]`
- `/cart`
- `/checkout`
- `/account`
- `/account/orders/[orderNumber]`

### API routes
- `/api/auth/*`
- `/api/products`
- `/api/products/[id]`
- `/api/orders`
- `/api/orders/[orderNumber]`
- `/api/customers`
- `/api/media`
- `/api/checkout/*`
- `/api/settings`

---

## Recommended data model direction

### Existing good foundations already present
- Store
- User
- Session
- Product
- ProductVariant
- Customer
- Order
- OrderItem
- Payment
- MediaAsset
- ProductMedia
- IntegrationConnection
- IntegrationSecret

### Recommended additions for real order architecture

#### OrderAddress
Separate address records instead of plain text blobs.

Suggested fields:
- id
- orderId
- type (`shipping`, `billing`)
- firstName
- lastName
- company
- address1
- address2
- city
- province
- postalCode
- country
- phone

#### Fulfillment
Needed for real shipping workflows and split shipments.

Suggested fields:
- id
- orderId
- status
- locationName
- carrier
- service
- trackingNumber
- labelUrl
- shippedAt
- deliveredAt
- createdAt
- updatedAt

#### FulfillmentItem
Needed for partial fulfillment and item-level shipment records.

Suggested fields:
- id
- fulfillmentId
- orderItemId
- quantity

#### OrderEvent
Needed to power timeline/history cleanly.

Suggested fields:
- id
- orderId
- type
- title
- detail
- actorType
- actorId
- createdAt

#### Refund
Needed to track actual refund records.

Suggested fields:
- id
- orderId
- paymentId
- amount
- reason
- note
- createdAt

#### Return
Needed to track return workflow separately from refund.

Suggested fields:
- id
- orderId
- status
- reason
- receivedAt
- createdAt
- updatedAt

---

## Order identity strategy

### Keep two identifiers
Doopify should keep:
- internal primary key: `id`
- human-facing order number: `orderNumber`

### Why
- `id` is stable for relations and backend internals
- `orderNumber` is what staff and customers expect to see
- routes can use `orderNumber` for cleaner admin URLs

Recommended admin detail route:
- `/orders/1005`

Displayed in UI as:
- `#1005`

This is not mainly a database trick. It is a UX, routing, and deep-linking decision.

---

## Website integration strategy

### Shared source of truth
All catalog and order data should come from Prisma-backed records.

### Frontend pattern
Use Next.js server components or route handlers for reads where possible, and client components only where interactivity is required.

### Admin pattern
- list pages can read server-side or through route handlers
- detail pages should fetch one real record by route param
- local optimistic state is okay for UI responsiveness, but database remains the source of truth

### Storefront pattern
- product pages read published product + variant + media data
- cart stores line selections client-side until checkout
- checkout writes final order, payment, events, and inventory changes to DB

---

## Recommended implementation sequence

### Phase 1 — Admin structure cleanup
- move Orders to list + dedicated detail route
- remove cramped split-pane interaction for orders
- make the detail page match Shopify-style page structure more closely

### Phase 2 — Order schema hardening
- add addresses
- add fulfillments
- add order events
- prepare refund/return structures

### Phase 3 — Real DB-backed reads
- replace mock order detail lookup with Prisma queries
- keep seed/bootstrap flow for local dev
- make orders page pull from database

### Phase 4 — Catalog publishing foundation
- mark products as active/draft/archived
- expose only publishable storefront products
- connect product media cleanly

### Phase 5 — Storefront MVP
- product listing page
- product detail page
- cart
- Stripe checkout
- order creation

### Phase 6 — Post-purchase/admin loop
- customer order pages
- fulfillment updates
- tracking visibility
- refund/return support

---

## Immediate next technical tasks
1. Refactor Orders UI to route-based detail pages
2. Improve order detail layout spacing and hierarchy
3. Expand Prisma schema for real order workflows
4. Create local `.env` from `.env.example`
5. Run Prisma generate + db push
6. Seed a bootstrap store/admin/order set
7. Start replacing mock order reads with real DB reads

---

## Guiding principle
Doopify should behave like a real commerce operating system, not a static admin demo. That means every UI decision should be moving toward:
- routeable records
- real persistence
- shared admin/storefront data
- realistic fulfillment and payment workflows
