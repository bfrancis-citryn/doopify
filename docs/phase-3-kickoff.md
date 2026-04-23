# Phase 3 Kickoff

This is the working execution brief for **Phase 3: Merchant Readiness And Storefront Differentiation**.

Use this document to guide implementation order, keep launch claims honest, and reduce re-planning between tasks.

## Why Phase 3 Starts Here

What already exists in the repo:

- checkout creation, Stripe webhook reconciliation, and paid-order creation
- typed internal events and first-party integration hooks
- Prisma `Collection` and `CollectionProduct` models
- seed data that already upserts starter collections

What is still missing:

- collection publish and unpublish semantics
- broader storefront merchandising refinement
- stronger merchandising surfaces
- expanded checkout pricing behavior
- automated coverage for the revenue path

## Repo Reality To Build Around

- `Collection` and `CollectionProduct` already exist in Prisma, so this phase should not start with schema invention unless the current fields prove insufficient
- `getStorefrontProducts()` already accepts `collectionHandle`, which is the cleanest current seam for collection-based storefront filtering
- collection list and detail reads now intentionally diverge, so new UI work should preserve summary payloads for list surfaces and reserve nested products for detail views only
- the app already has public storefront DTO discipline for products; collections should follow that pattern
- the launch story is strongest when we ship visible merchant outcomes before any deeper platform extraction

## Phase 3 Workstreams

### Current baseline

The first Phase 3 slice is now in place:

- collection service layer and DTOs
- summary and detail collection query split for admin and storefront reads
- admin collection APIs
- admin collection workspace at `/admin/collections`
- storefront collection APIs and routes
- homepage and shop collection merchandising hooks
- targeted collection page revalidation plus faster admin save and delete flows

### Current verification status

Passed now:

- merchants can create, edit, delete, assign, and reorder collection products
- storefront collection list and detail routes expose storefront-safe product data only
- homepage, `/collections`, `/collections/[handle]`, and `/shop` now use lighter collection summaries unless nested product detail is actually needed
- admin save and delete flows no longer reload the entire workspace or refetch the 200-product library after each mutation

Still pending:

- collection publish and unpublish semantics
- automated coverage for collections and the checkout plus webhook revenue path

### 1. Collections

Goal: make collections a real merchandising primitive.

Deliverables:

- collection service layer for admin reads, writes, and product assignment
- admin APIs:
  - `GET /api/collections`
  - `POST /api/collections`
  - `PATCH /api/collections/[id]`
  - `DELETE /api/collections/[id]`
- storefront APIs:
  - `GET /api/storefront/collections`
  - `GET /api/storefront/collections/[handle]`
- storefront routes:
  - `/collections`
  - `/collections/[handle]`
- featured collections on the homepage

Definition of done:

- merchants can create and edit collections
- merchants can assign and order products inside a collection
- storefront collection pages render only active, storefront-safe product data
- collection list and merchandising surfaces use summary payloads instead of nested product overfetching

### 2. Checkout Pricing Hardening

Goal: keep checkout server-owned while making pricing more realistic for launch.

Deliverables:

- a pricing interface or service boundary that can evolve without moving totals logic client-side
- discount application support in checkout totals
- a clearer shipping strategy for current launch scope
- tax handling that is either implemented minimally or documented explicitly as a current limitation
- clearer failed-payment and stock-exhaustion behavior

Definition of done:

- checkout totals are still recomputed on the server
- invalid discounts or stale inventory fail cleanly
- success and failure states are obvious in the customer flow

### 3. Storefront Differentiation

Goal: make the storefront feel intentional enough for launch demos and screenshots.

Deliverables:

- reusable merchandising blocks instead of one-off homepage composition
- stronger branding from settings and tokens
- better featured-product and featured-collection presentation on `/` and `/shop`
- cleaner empty states and collection discovery paths

Definition of done:

- the storefront demonstrates more than a generic product grid
- branding can be changed without rewriting components
- launch materials can point to clear merchandising value

### 4. Automated Coverage

Goal: protect the revenue path before launch messaging gets louder.

Priority cases:

- checkout creation success
- checkout validation failure
- duplicate Stripe webhook delivery idempotency
- invalid Stripe signature rejection
- stock exhaustion during checkout creation
- collection visibility and storefront-safe data exposure

Definition of done:

- the highest-risk purchase-path behavior is covered by automated checks
- regressions in order creation or storefront exposure are easier to catch before release

## Recommended Build Order

1. Collections service layer and DTOs
2. Admin collection APIs
3. Storefront collection APIs and routes
4. Homepage and shop merchandising updates
5. Checkout pricing hardening
6. Automated coverage for the revenue path and collections

This order gives us the fastest path to visible product value while preserving launch credibility.

## Public Interfaces To Add

### Admin

- `GET /api/collections`
- `POST /api/collections`
- `PATCH /api/collections/[id]`
- `DELETE /api/collections/[id]`

### Storefront

- `GET /api/storefront/collections`
- `GET /api/storefront/collections/[handle]`
- `/collections`
- `/collections/[handle]`

### Internal

- collection DTOs for storefront-safe reads
- service-layer collection assignment and ordering helpers
- checkout pricing contract that keeps totals server-owned

## Launch Guardrails

Do say:

- developer-first commerce engine
- real storefront and admin in one codebase
- Stripe-ready checkout architecture
- collection-driven merchandising
- typed server-side extension seams

Do not say yet:

- plugin marketplace
- public app platform
- schema-generated admin
- enterprise multi-tenant commerce platform

## Completion Signals

Phase 3 is materially underway when:

- collections are demoable in admin and storefront
- the homepage and shop better reflect merchandising intent
- checkout pricing is harder to misrepresent or break
- the launch story is supported by live product behavior
