# Doopify Order Management Overhaul Plan

> Phase-by-phase execution plan for fixing order correctness, draft-order data flow, customer linkage, fulfillment/shipping labels, refunds/returns, and the Shopify-inspired order detail experience.
>
> Created: April 30, 2026
> Status: planned implementation slice

## Goal

Make Doopify order management usable for real merchants.

The current order detail and draft-order flows are not merchant-ready because:

- the order detail page is visually disorganized
- returns/refunds can show `Invalid order number`
- draft orders can show placeholder/fallback product data instead of real products and variants
- draft orders do not provide a complete inline manual customer creation flow
- converted draft orders should redirect to the live order detail page
- inventory must stay synced with real product variants
- order detail needs real actions for fulfillment, labels, tracking, notes, customer email, refunds, and discounts

This plan fixes correctness first, then rebuilds the UI around a Shopify-inspired information architecture.

## Product Direction

Use Shopify as a structural UX reference, not as copied UI.

Doopify order detail should feel like a serious commerce operations surface:

- clear status chips for payment, fulfillment, and order state
- left-column operational cards for fulfillments, line items, payment summary, refunds/returns, and timeline
- right-column customer, notes, shipping address, billing address, and metadata cards
- obvious action buttons for shipping labels, tracking, status changes, refunds, notes, and customer communication

## Architecture Rules

- Prisma/Postgres remains the source of truth.
- Route handlers stay thin: parse, validate, authorize, call services, return stable responses.
- Service modules own order, draft-order, customer, fulfillment, refund, inventory, and email behavior.
- Browser state must not create fake product/order/customer truth.
- Checkout totals, inventory, payment truth, refunds, fulfillment state, and order creation remain server-owned.
- Historical orders use immutable line-item snapshots so product edits do not rewrite past order truth.
- Verified Stripe webhook success remains the normal payment-finalized order path.
- Admin-created draft orders can create live orders through explicit admin services, but must still use the same money, inventory, customer, and event invariants.
- Do not expose payment/provider secrets or private integration data in admin responses.

## Non-Goals For This Slice

- Do not rebuild the entire checkout system.
- Do not add PayPal or Apple Pay.
- Do not replace the handcrafted admin with generated CRUD.
- Do not introduce customer account auth.
- Do not create a plugin marketplace or runtime plugin loader.
- Do not build a full Shopify clone. Build the order workflows Doopify needs now.

## Recommended Execution Order

1. Fix order/refund identifier correctness.
2. Fix draft-order real product/variant snapshots.
3. Add inline customer creation and draft-to-customer linkage.
4. Fix draft-to-order conversion, redirect, and inventory sync.
5. Create a unified admin order detail view model.
6. Rebuild order detail UI.
7. Wire fulfillment, shipping label, tracking, customer note/email, and refund actions.
8. Expand tests and docs.

---

## Phase 0 — Source Inspection And Reality Check

### Intent

Confirm current schema, services, APIs, and UI before changing behavior.

### Inspect

- Prisma models for `Order`, `OrderLineItem`, `DraftOrder`, `Customer`, `Payment`, `Refund`, `Return`, `Fulfillment`, `Shipment`, `ShippingLabel`, `OrderEvent`, and `OrderNote` if present.
- Admin order routes and order detail page.
- Draft order routes/components/services.
- Customer create/update APIs.
- Inventory/product variant services.
- Refund/return services and routes.
- Shipping provider/label services.
- Email delivery/provider services.
- Existing tests for checkout, draft orders, refunds, returns, inventory, shipping, and email.

### Deliverable

A short implementation note in the PR description or commit body listing:

- the current order identifier contract
- where draft order line items are stored
- how draft conversion currently creates live orders
- how refunds/returns currently query orders
- which fulfillment/shipping-label pieces already exist

### Acceptance Checks

- No behavior change yet unless a tiny broken import or obvious typo blocks inspection.
- No duplicate service created when an existing service should be extended.

---

## Phase 1 — Fix Order Identifier And Returns/Refunds Loading

### Intent

Fix the `Invalid order number` problem before UI work hides the actual data issue.

### Problems To Solve

The UI may show an order display number such as `#DPY0001`, while refund/return/adjustment APIs may expect an internal `order.id`, numeric order number, or another identifier. The page must use one safe order identity contract.

### Tasks

1. Locate the route/component that loads returns/refunds/adjustments on order detail.
2. Identify whether it passes:
   - internal order id
   - display order number
   - numeric order number
   - order name with `#`
3. Normalize route/service behavior so adjustments can resolve the order safely.
4. Prefer internal `order.id` for private admin APIs.
5. If accepting display number is useful, resolve it in the service layer and reject ambiguity.
6. Add safe errors:
   - `Order not found`
   - `Invalid order identifier`
   - not generic `Invalid order number` when the page clearly has an order.

### Tests

Add or update tests for:

- returns/refunds load for a normal order using internal id
- returns/refunds load for a converted draft order
- display order number resolution if supported
- invalid identifier fails safely

### Acceptance Checks

- Order detail no longer shows `Invalid order number` for valid live orders.
- Refund/return data loads or shows an accurate empty state.
- Existing refund/return lifecycle tests remain green.

---

## Phase 2 — Fix Draft Order Product And Variant Data

### Intent

Draft orders must use real product and variant data. No placeholder product data should appear unless a historical product was deleted and the immutable snapshot is intentionally being used.

### Tasks

1. Audit draft line item creation.
2. Ensure draft order items store or can resolve:
   - `productId`
   - `variantId`
   - product title snapshot
   - variant title/options snapshot
   - SKU snapshot
   - image snapshot
   - unit price snapshot
   - compare-at price snapshot if available
   - quantity
   - taxable/shippable flags if present
3. Remove incorrect fallback rendering that shows fake demo products.
4. When adding products to draft orders, use the real product/variant picker and live variant data.
5. Preserve historical display from snapshots after product changes.

### Tests

Add/update tests for:

- adding a real variant to a draft order stores correct product/variant ids
- draft order detail renders real title, variant, image, SKU, price, and quantity
- deleted/changed product still renders from snapshot
- no placeholder product appears for valid draft lines

### Acceptance Checks

- Draft order UI shows real products and variants.
- Draft line items are safe for later conversion.
- Product edits after draft creation do not corrupt draft display.

---

## Phase 3 — Add Manual Customer Creation In Draft Orders

### Intent

Draft orders should support both existing-customer selection and inline manual customer creation.

### UX Requirements

Keep current behavior:

- search/select existing customer
- allow guest/no customer if current app behavior supports guest orders

Add:

- `Create customer manually` option inside draft order
- fields:
  - first name
  - last name
  - email
  - phone optional
  - shipping address optional
  - billing address optional
- validation with clear inline errors

### Service Requirements

1. If existing customer is selected, attach that customer.
2. If manual customer data is entered, create a customer record before or during draft save/convert.
3. Link the created customer to the draft order and live order.
4. Ensure the created customer appears in Customers.
5. Avoid duplicate customers by email where the current customer model supports that safely.
6. Create order timeline/customer event where available.

### Tests

Add/update tests for:

- selecting existing customer attaches to draft order
- manual customer creation creates a customer record
- manual customer is attached to converted live order
- manually created customer appears in customer list/query
- guest order still works if supported

### Acceptance Checks

- A merchant can create a draft order for a new customer without leaving the draft order screen.
- Converted order has correct customer information.
- Customer data persists outside the order.

---

## Phase 4 — Fix Draft-To-Live Order Conversion, Redirect, And Inventory Sync

### Intent

Draft conversion should create a real live order with correct items, customer, totals, timeline, and inventory behavior.

### Conversion Requirements

When converting draft to live order:

- create a real `Order`
- create immutable `OrderLineItem` snapshots from draft line items
- attach selected or newly created customer
- preserve shipping, tax, discounts, notes, billing, and shipping addresses
- update inventory using real variant ids
- block conversion if inventory is insufficient
- create timeline event: `Draft order converted`
- mark draft converted/closed so it cannot be converted twice
- redirect to the live order detail page

### Redirect Requirement

After successful conversion, redirect to the app's live order detail route, for example:

```txt
/admin/orders/[orderId]
```

or the repo's current equivalent.

### Tests

Add/update tests for:

- draft conversion creates live order
- order line items use draft snapshots and variant ids
- inventory decrements for stocked variants
- insufficient inventory blocks conversion
- duplicate conversion is idempotent or safely rejected
- customer is attached
- converted draft redirects/returns live order URL/id

### Acceptance Checks

- Merchant converts a draft and lands on the live order page.
- Inventory does not go negative.
- Converted orders are indistinguishable from normal live orders for admin operations.

---

## Phase 5 — Create Unified Admin Order Detail View Model

### Intent

The order detail page should not stitch together random route responses. Build one service-owned view model that organizes all order data.

### Suggested Service

```txt
src/server/services/admin-order-detail.service.ts
```

or extend the existing order service if one already owns this concern.

### View Model Shape

Return safe admin data for:

- order id
- display number/name
- source channel
- created timestamp
- payment status
- fulfillment status
- order status
- customer summary
- customer stats if cheap/safe
- shipping address
- billing address
- internal notes
- customer note
- line items
- discounts
- shipping summary
- tax summary
- payment summary
- transactions/payment records
- refunds
- returns
- fulfillments/shipments
- tracking numbers and URLs
- label records if present
- timeline events
- available actions/capabilities

### API Requirements

Add or refactor a private admin route such as:

```txt
GET /api/orders/[id]/detail
```

or use the repo's current order detail route.

### Tests

Add/update tests for:

- order detail returns complete normalized structure
- missing optional relationships return empty arrays/nulls, not crashes
- converted draft order detail includes draft-converted timeline event
- refunds/returns/fulfillments appear in the correct sections

### Acceptance Checks

- Order detail UI can render from one coherent payload.
- No raw Prisma private fields leak to admin UI unintentionally.
- UI no longer depends on invalid display-number parsing for sub-panels.

---

## Phase 6 — Rebuild Order Detail UI

### Intent

Rebuild the page into a clear Shopify-inspired order operations layout.

### Header

Show:

- order number
- created date/time
- source
- payment status badge
- fulfillment status badge
- order status badge
- quick actions:
  - mark paid/unpaid when supported
  - buy shipping label
  - print packing slip
  - print/reprint label
  - add tracking
  - send update email
  - refund
  - cancel
  - refresh

### Left Column

#### Fulfillment Card

Show:

- fulfilled/unfulfilled groups
- items and quantities
- carrier/service
- tracking number and link
- label purchased/printed status
- shipped/delivered timestamps if available

Actions:

- buy label
- reprint label
- mark fulfilled
- add tracking
- send shipment update

#### Line Items Card

For each item:

- image
- product title
- variant title/options
- SKU
- quantity
- unit price
- discount allocation
- tax allocation if available
- line total
- fulfillment state
- refunded/returned quantity

#### Payment Summary Card

Show:

- subtotal
- discounts
- shipping
- taxes
- total
- paid
- refunded
- net payment
- payment method/source
- transactions if available

#### Returns & Refunds Card

Show:

- refund records
- return records
- reason
- amount
- item quantities
- status

Actions:

- create refund
- start return

#### Timeline Card

Show chronological events:

- order created
- draft converted
- payment captured
- fulfillment created
- label purchased
- tracking added
- email sent
- note added
- refund issued
- return status changed
- order status changed

### Right Column

#### Notes Card

- internal notes
- customer-visible notes
- add/edit note
- send note to customer separately when supported

#### Customer Card

- name
- email
- phone
- order count
- total spent
- link to customer profile

#### Shipping Address Card

- full address
- edit action if supported
- map link

#### Billing Address Card

- full address
- edit action if supported

### Tests

If component tests exist, cover:

- page renders order detail view model
- empty states for no refunds/returns/fulfillments
- status badges map correctly
- customer/address cards render safely with missing optional fields

### Acceptance Checks

- Order detail is organized and action-oriented.
- It shows real customer, item, fulfillment, payment, refund, and timeline data.
- Empty states are intentional, not broken panels.

---

## Phase 7 — Wire Fulfillment, Shipping Labels, Tracking, And Customer Emails

### Intent

Order detail should support real fulfillment operations from the order page.

### Tasks

1. Buy shipping label from order detail using connected Shippo/EasyPost provider.
2. Select items/quantities to fulfill.
3. Select package/service/rate where required.
4. Persist fulfillment/shipment/label record.
5. Save tracking number, tracking URL, carrier, service, label URL/file reference.
6. Print/reprint label.
7. Add tracking manually when label is not purchased in-app.
8. Send shipment notification email with tracking number.
9. Add timeline events for all actions.

### Tests

Add/update tests for:

- label purchase creates fulfillment/shipment record
- tracking number is saved
- tracking email is queued/sent through email delivery service
- manual tracking creates timeline event
- reprint label does not create duplicate fulfillment
- provider failure leaves order state consistent

### Acceptance Checks

- A merchant can buy/print a label from the order page.
- Tracking is visible on the order.
- Customer can be notified with tracking.
- Provider failure does not corrupt fulfillment state.

---

## Phase 8 — Wire Refunds, Returns, Notes, Discounts, And Status Actions

### Intent

Complete the merchant lifecycle actions needed inside order detail.

### Refunds

Support:

- full refund
- partial refund
- line-item quantity refund
- shipping refund
- tax-aware amounts where current pricing model supports it
- restock toggle
- notify customer toggle
- reason field
- timeline event

### Returns

Support:

- start return
- approve/decline
- mark in transit
- mark received
- close with refund
- return reason and condition

### Notes

Support:

- internal note
- customer-visible note
- send note/email to customer
- timeline event for note actions

### Discounts

Display:

- discount codes
- manual/automatic discount labels
- order-level discount total
- line-level discount allocations if available

### Status Actions

Support only where service invariants allow:

- mark paid/unpaid for manual/admin flows
- cancel order
- archive/close order
- reopen when supported

### Tests

Add/update tests for:

- refund updates payment/order/refund totals
- restock updates inventory only after valid refund success
- return transitions follow state machine
- note creation creates correct visibility
- customer email note does not duplicate commerce side effects
- discount display uses persisted snapshots

### Acceptance Checks

- Merchant can manage refunds/returns without leaving order detail.
- Payment, inventory, and timeline stay consistent.
- Discounts are visible and understandable.

---

## Phase 9 — Docs, Verification, And Exit Criteria

### Docs To Update

When behavior changes, update:

- `docs/STATUS.md`
- `docs/features-roadmap.md`
- `docs/HARDENING.md`
- `README.md` only if headline capabilities/routes/onboarding change

### Verification Commands

Run before merge:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

For revenue-path/inventory/payment/refund/fulfillment behavior, also run gated integration tests when configured:

```bash
DATABASE_URL_TEST="postgresql://..." npm run test:integration
```

### Full Acceptance Criteria

This plan is complete when:

- valid orders no longer show `Invalid order number` in returns/refunds
- draft orders use real products, variants, prices, images, SKUs, and snapshots
- draft orders support selecting an existing customer or creating one manually
- converted drafts redirect to the live order detail page
- converted drafts create real orders with correct inventory behavior
- customer created from draft appears in Customers
- order detail renders an organized Shopify-inspired operations layout
- order detail shows customer, addresses, line items, totals, discounts, payments, fulfillments, refunds, returns, and timeline
- shipping labels and tracking can be managed from order detail where provider setup exists
- tracking notifications can be sent to customers
- refunds/returns can be managed from order detail
- tests cover identifier correctness, draft conversion, inventory sync, customer linkage, order detail payload, fulfillment/label workflow, refund workflow, and email notification behavior

---

# Phase-by-Phase Codex Prompts

Use these instead of one giant all-in-one prompt. Each phase should be a separate PR or tightly scoped commit series.

## Prompt 1 — Identifier And Refund/Return Loading

```txt
You are working in the Doopify repo.

Read first:
- docs/STATUS.md
- docs/PROJECT_INTENT.md
- docs/features-roadmap.md
- docs/HARDENING.md
- docs/CONTRIBUTING.md
- AGENTS.md
- docs/ORDER_MANAGEMENT_OVERHAUL_PLAN.md

Goal:
Fix the order detail Returns & refunds panel showing `Invalid order number` for valid orders.

Scope:
- Inspect order detail UI, refund/return APIs, and services.
- Identify whether the UI passes internal order id, display order number, numeric order number, or `#DPY...` style order name.
- Normalize the order identifier contract.
- Prefer internal order id for private admin API calls.
- If display numbers are accepted, resolve them safely in service/route logic.
- Add clear empty/error states.

Do not redesign the whole order page in this phase.

Tests:
- refunds/returns load for a valid order
- refunds/returns load for a converted draft order if supported by fixtures
- invalid identifier fails safely
- valid display number resolves only if intentionally supported

Run:
- npm run test
- npx tsc --noEmit
- npm run build
```

## Prompt 2 — Draft Order Real Product/Variant Data

```txt
You are working in the Doopify repo.

Read docs/ORDER_MANAGEMENT_OVERHAUL_PLAN.md and canonical docs first.

Goal:
Make draft orders use real product/variant data and immutable line-item snapshots. Remove incorrect placeholder product display.

Scope:
- Inspect draft order product picker, line-item storage, detail rendering, and conversion service.
- Ensure draft line items store/resolve productId, variantId, title, variant title/options, SKU, image, unit price, compare-at price, and quantity.
- Use snapshots for historical display.
- Do not use fake fallback products for valid draft lines.

Tests:
- adding real variant stores correct ids and snapshots
- draft detail renders real item data
- product edits after draft creation do not corrupt snapshot display
- placeholder/demo product is not shown for valid lines

Run:
- npm run test
- npx tsc --noEmit
- npm run build
```

## Prompt 3 — Draft Customer Creation And Linkage

```txt
You are working in the Doopify repo.

Read docs/ORDER_MANAGEMENT_OVERHAUL_PLAN.md and canonical docs first.

Goal:
Add inline manual customer creation to draft orders while keeping existing customer selection.

Scope:
- Keep current select-existing-customer flow.
- Add `Create customer manually` UI in draft order flow.
- Required fields: first name, last name, email.
- Optional fields: phone, billing address, shipping address.
- Create customer record on save/convert when manual customer is provided.
- Link customer to draft/live order.
- Ensure customer appears in Customers tab/list.
- Preserve guest order behavior if currently supported.

Tests:
- selecting existing customer attaches to draft
- manual customer creates Customer record
- manual customer links to converted order
- customer appears in customer list/query
- guest order still works if supported

Run:
- npm run test
- npx tsc --noEmit
- npm run build
```

## Prompt 4 — Draft Conversion, Redirect, And Inventory Sync

```txt
You are working in the Doopify repo.

Read docs/ORDER_MANAGEMENT_OVERHAUL_PLAN.md and canonical docs first.

Goal:
Make draft-to-live order conversion reliable.

Scope:
- Convert draft into real live order.
- Create immutable order line-item snapshots from draft items.
- Attach selected or manually created customer.
- Preserve shipping, tax, discounts, notes, and addresses.
- Use real variant ids for inventory updates.
- Block conversion when inventory is insufficient.
- Prevent duplicate conversion.
- Create timeline event `Draft order converted` if timeline exists.
- Return/redirect to live order detail route after conversion.

Tests:
- conversion creates live order
- order line items contain snapshots and variant ids
- inventory decrements correctly
- insufficient inventory blocks conversion
- duplicate conversion is safe
- response includes live order route/id for redirect

Run:
- npm run test
- DATABASE_URL_TEST="postgresql://..." npm run test:integration if configured for inventory paths
- npx tsc --noEmit
- npm run build
```

## Prompt 5 — Admin Order Detail View Model

```txt
You are working in the Doopify repo.

Read docs/ORDER_MANAGEMENT_OVERHAUL_PLAN.md and canonical docs first.

Goal:
Create one normalized admin order detail view model for the order page.

Scope:
- Create or extend a service like src/server/services/admin-order-detail.service.ts.
- Return order identity, statuses, source, customer summary, addresses, notes, line items, discounts, payment summary, transactions, refunds, returns, fulfillments, shipments, labels, tracking, timeline, and available actions.
- Add/refactor a private admin API to return this payload.
- Keep route handler thin.
- Do not expose secrets or unnecessary raw Prisma fields.

Tests:
- complete order returns full view model
- missing optional relationships return empty arrays/nulls safely
- converted draft includes customer and draft-converted timeline where available
- refunds/returns/fulfillments appear in expected sections

Run:
- npm run test
- npx tsc --noEmit
- npm run build
```

## Prompt 6 — Shopify-Inspired Order Detail UI

```txt
You are working in the Doopify repo.

Read docs/ORDER_MANAGEMENT_OVERHAUL_PLAN.md and canonical docs first.

Goal:
Rebuild order detail UI around the new admin order detail view model.

Scope:
- Header with order number, created date, source, payment/fulfillment/order status chips, quick actions.
- Left column: fulfillment, line items, payment summary, returns/refunds, timeline.
- Right column: notes, customer, shipping address, billing address.
- Use Doopify design system; Shopify screenshot is information architecture inspiration only.
- Empty states should be intentional.
- Do not wire destructive actions unless backend service already exists.

Tests:
- render order detail view model
- empty states for no refunds/returns/fulfillments
- status chips map correctly
- customer/address cards handle missing optional fields

Run:
- npm run test
- npx tsc --noEmit
- npm run build
```

## Prompt 7 — Fulfillment, Labels, Tracking, And Emails

```txt
You are working in the Doopify repo.

Read docs/ORDER_MANAGEMENT_OVERHAUL_PLAN.md and canonical docs first.

Goal:
Wire real fulfillment operations into order detail.

Scope:
- Buy shipping label using connected Shippo/EasyPost provider where supported.
- Select items/quantities for fulfillment.
- Persist fulfillment/shipment/label/tracking records.
- Print/reprint label.
- Add tracking manually.
- Send shipment notification email with tracking number.
- Add timeline events.
- Keep provider failure from corrupting order state.

Tests:
- label purchase creates fulfillment/shipment record
- tracking is saved
- tracking email delivery is queued/sent
- manual tracking creates timeline event
- reprint label does not duplicate fulfillment
- provider failure leaves state consistent

Run:
- npm run test
- DATABASE_URL_TEST="postgresql://..." npm run test:integration if configured
- npx tsc --noEmit
- npm run build
```

## Prompt 8 — Refunds, Returns, Notes, Discounts, And Status Actions

```txt
You are working in the Doopify repo.

Read docs/ORDER_MANAGEMENT_OVERHAUL_PLAN.md and canonical docs first.

Goal:
Complete merchant lifecycle actions in order detail.

Scope:
- Full/partial line-item refunds with optional shipping/tax where supported.
- Restock toggle and notify-customer toggle.
- Return workflow actions: start, approve, decline, in transit, received, close with refund.
- Internal notes and customer-visible notes.
- Send note/email to customer where email service supports it.
- Display discount codes, manual/automatic discounts, order-level totals, and line allocations where available.
- Only expose status actions that current service invariants support.

Tests:
- refund updates payment/order/refund totals
- restock updates inventory only after valid refund success
- return state machine remains valid
- notes have correct visibility
- customer email note does not duplicate commerce side effects
- discount display uses persisted snapshots

Run:
- npm run test
- DATABASE_URL_TEST="postgresql://..." npm run test:integration if configured
- npx tsc --noEmit
- npm run build
```
