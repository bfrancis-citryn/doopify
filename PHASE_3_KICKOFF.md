# Phase 3 Kickoff - Merchant Readiness And Storefront Differentiation

> Active execution brief.
>
> Documentation refresh: April 26, 2026
> Current phase: **Phase 3**

## Phase Intent

Phase 3 turns Doopify from a working commerce foundation into a more merchant-ready, demoable, developer-first product.

The goal is not to invent a new foundation. The foundation is already present.

The goal is to strengthen:

- collection-driven merchandising
- checkout pricing correctness
- failure handling
- automated revenue-path coverage
- launch proof points

## Starting Assumptions

Already available:

- Prisma/Postgres commerce schema
- product and variant data
- store settings
- media workflows
- admin auth/session protection
- storefront product routes
- checkout creation route
- Stripe webhook route
- checkout status route
- typed internal events
- static integration registry
- collection models
- starter collection seed data
- collection-aware storefront filtering

## Current Slice Shipped

- collection service layer
- storefront-safe collection DTOs
- collection summary/detail query split
- admin collection APIs
- admin collection workspace
- storefront collection APIs
- storefront collection routes
- collection merchandising on homepage/shop surfaces
- targeted collection revalidation
- local admin collection mutation state updates
- collection publish/unpublish semantics with storefront filtering
- centralized checkout pricing service in `src/server/checkout/pricing.ts`
- checkout-native code discounts through the centralized pricing service
- discount applications and usage counts created only after verified paid order creation succeeds
- fast automated tests for pricing, discount-code math, checkout creation, duplicate payment-intent completion, invalid webhook signatures, and storefront collection DTO safety
- `DATABASE_URL_TEST`-gated real-DB integration tests for paid checkout inventory decrement, duplicate payment-intent idempotency, competing duplicate completions, insufficient-stock consistency, and paid-only/idempotent discount usage
- the real-DB integration run exposed and fixed a concurrent checkout customer-creation race during payment-intent completion

## Phase 3 Build Order

### 1. Harden Checkout Pricing

The initial revenue-path coverage is now in place and has been executed against a disposable Postgres test target. Continue checkout pricing from code discounts into the remaining money rules.

Pricing service should own:

- live item validation
- product/variant availability
- subtotal
- discounts
- shipping
- tax
- total
- currency
- rounding
- persisted checkout snapshot

Acceptance:

- browser never owns totals
- discount logic stays server-side and idempotent after verified payment success
- shipping/tax additions do not move pricing client-side
- checkout and webhook behavior remains idempotent

### 2. Cover Admin Collections

Finish and verify:

- create collection
- edit collection
- delete collection
- assign products
- order products inside a collection
- view collections on storefront
- view collection detail pages
- protect admin-only mutations
- expose only storefront-safe DTOs publicly
- verify publish/unpublish behavior across admin and storefront

Acceptance:

- merchants can manage collections without manual DB changes
- public users can browse collections without seeing private fields
- list pages avoid nested product overfetching
- collection mutations do not reload the entire admin workspace unnecessarily

### 3. Improve Failure Handling

Strengthen UX and state handling for:

- failed payment
- canceled payment
- inventory exhaustion
- stale cart items
- inactive products
- deleted variants
- duplicate webhook delivery
- missing checkout session
- order confirmation email failures

Acceptance:

- users see clear failure states
- operators can debug what happened
- failures do not corrupt order/payment/inventory data

### 4. Expand Automated Coverage

Prioritize tests around revenue and trust boundaries:

- checkout validation failures
- inventory exhaustion
- collection admin auth
- collection assignment behavior
- real-DB idempotency and race-condition behavior

Acceptance:

- core commerce loop can be changed with confidence
- launch demos are backed by repeatable verification

### 5. Strengthen Storefront Merchandising

Build proof that the storefront is more than a catalog dump.

Focus:

- homepage featured collections
- shop collection filters/sections
- collection detail pages
- stronger empty states
- branding tokens from settings
- reusable storefront content blocks

Acceptance:

- demo path clearly shows merchant-created collections affecting storefront browsing
- the developer-first story is visible in the product

## Phase 3 Non-Goals

Do not spend this phase on:

- plugin marketplace
- theme marketplace
- multi-tenant SaaS
- full schema-generated admin replacement
- runtime plugin loading
- broad platform extraction

## Phase Exit Criteria

Phase 3 is ready to exit when:

- collections work end-to-end
- checkout pricing supports the next discount/shipping/tax layer safely
- revenue path has automated coverage
- failure states are clearer
- launch positioning is backed by working product proof
- hardening gaps are narrowed enough for credible demos and early users
