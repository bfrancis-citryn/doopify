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
- baseline destination-aware shipping zone rates and tax rules in centralized pricing
- settings-backed domestic/international shipping and tax rates consumed by checkout pricing
- discount applications and usage counts created only after verified paid order creation succeeds
- durable Stripe webhook delivery logging with provider event id, type, status, attempts, processed timestamp, last error, and payload hash
- webhook replay API + admin workspace visibility at `/api/webhook-deliveries`, `/api/webhook-deliveries/[id]/replay`, and `/admin/webhooks`
- fast automated tests for pricing, settings-backed shipping/tax behavior, discount-code math, checkout creation, duplicate payment-intent completion, invalid webhook signatures, webhook delivery logging/replay behavior, admin collection mutations, storefront collection routes, and storefront collection DTO safety
- `DATABASE_URL_TEST`-gated real-DB integration tests for paid checkout inventory decrement, duplicate payment-intent idempotency, competing duplicate completions, insufficient-stock consistency, and paid-only/idempotent discount usage
- the real-DB integration run exposed and fixed a concurrent checkout customer-creation race during payment-intent completion

## Phase 3 Build Order

### 1. Expand Revenue-Path Race Coverage

The initial revenue-path coverage is in place. Extend real-DB race/idempotency assertions beyond duplicate payment-intent completion so concurrent payment-success paths remain deterministic.

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
- shipping/tax refinement does not move pricing client-side
- checkout and webhook behavior remains idempotent

### 2. Refine Shipping, Tax, Discount, And Replay Operations

Current pricing now includes baseline destination-aware shipping and tax behavior. Next, move from baseline rules to configurable merchant-grade logic and finish checkout UX around discount rejections and stale-cart handling.

- configurable shipping zones/rates
- jurisdiction-aware tax refinement
- discount rejection/out-of-stock/stale-cart UX around checkout failures
- automated webhook retry controls and richer support diagnostics on top of replay + delivery logs

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
