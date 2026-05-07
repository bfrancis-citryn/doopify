# Shipping Setup And Labels Roadmap

> Roadmap for adding Doopify shipping setup, manual flat rates, live carrier rates, manual fulfillment, shipping label purchase, and label printing.

## Goal

Build a clean shipping system with three paths:

1. Manual built-in shipping rates for merchants who do not want a carrier integration.
2. Live carrier rates through providers such as EasyPost or Shippo.
3. Shipping label purchase and printing from the order page.

Manual shipping must always work even if no live provider is connected.

## Critical Rule

Checkout shipping charge and merchant label cost are different.

Example:

- Customer pays shipping: $9.99
- Merchant buys label: $6.42
- Shipping margin: $3.57

`Order.shippingAmountCents` is the customer charge.
A future `ShippingLabel.labelAmountCents` should store the merchant label cost.

## Existing Foundation

Doopify already has:

- `Store.shippingDomesticRateCents`
- `Store.shippingInternationalRateCents`
- `Store.shippingThresholdCents`
- `ShippingZone`
- `ShippingRate`
- `ShippingRateMethod.FLAT`
- `ShippingRateMethod.SUBTOTAL_TIER`
- `ProductVariant.weight`
- `ProductVariant.weightUnit`
- `Order.shippingAmountCents`
- `Fulfillment.carrier`
- `Fulfillment.service`
- `Fulfillment.trackingNumber`
- `Fulfillment.trackingUrl`
- `Fulfillment.labelUrl`
- `FulfillmentItem`
- `Integration`
- `IntegrationSecret`
- `Job`
- `requireAdmin(req)`

Use these instead of creating a parallel shipping system.

## Hard Rules

- Manual flat-rate shipping must work without EasyPost or Shippo.
- Admin shipping mutations must use `requireAdmin(req)`.
- Provider credentials must be stored with the existing integration secret pattern and never returned to the browser.
- Checkout must never trust client-submitted shipping amounts.
- Server must revalidate selected shipping before creating or updating payment amounts.
- Buying a label must not change order totals.
- Buying a label must not mark an order paid.
- Stripe webhook success remains the only paid-order finalization path.
- Money stays in integer cents internally.
- Dashboard inputs display normal dollars.
- Do not buy labels during checkout.

---

## Phase 1 — Manual Shipping Settings Tab

### Goal

Expose the built-in manual shipping system in admin.

### Page

`/admin/settings/shipping`

### UI Sections

- Shipping mode
- Manual flat rates
- Free-shipping threshold
- Shipping zones
- Subtotal-tiered rates
- Manual rate preview

### Schema

Add:

```prisma
enum ShippingMode {
  MANUAL
  LIVE_RATES
  HYBRID
}

enum ShippingLiveProvider {
  EASYPOST
  SHIPPO
}
```

Add to `Store`:

```prisma
shippingMode ShippingMode @default(MANUAL)
shippingLiveProvider ShippingLiveProvider?
```

### API

Add or update:

```txt
GET /api/settings/shipping
PATCH /api/settings/shipping
```

Rules:

- `PATCH` uses `requireAdmin(req)`.
- Zod validate input.
- Convert dollars to cents at the API boundary.
- Keep service logic cents-only.

### Acceptance Criteria

- Merchant can set domestic flat rate.
- Merchant can set international flat rate.
- Merchant can set free-shipping threshold.
- Merchant can create and edit shipping zones.
- Merchant can create flat and subtotal-tiered rates.
- UI displays dollars.
- Database stores cents.

---

## Phase 2 — Shipping Setup Wizard

### Goal

Create a guided setup wizard for manual, live, and hybrid shipping.

### Wizard Steps

1. Choose shipping mode
2. Enter origin address
3. Add default package
4. Configure manual fallback rates
5. Connect live provider when needed
6. Test rates
7. Finish with setup summary

### Store Fields To Add

```prisma
shippingOriginName String?
shippingOriginPhone String?
shippingOriginAddress1 String?
shippingOriginAddress2 String?
shippingOriginCity String?
shippingOriginProvince String?
shippingOriginPostalCode String?
shippingOriginCountry String?

defaultPackageWeightOz Int?
defaultPackageLengthIn Float?
defaultPackageWidthIn Float?
defaultPackageHeightIn Float?

defaultLabelFormat String? @default("PDF")
defaultLabelSize String? @default("4x6")
shippingFallbackEnabled Boolean @default(true)
```

### Optional Package Presets

```prisma
model ShippingPackagePreset {
  id        String   @id @default(cuid())
  name      String
  weightOz  Int?
  lengthIn  Float
  widthIn   Float
  heightIn  Float
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("shipping_package_presets")
}
```

### Setup Status Shape

```ts
type ShippingSetupStatus = {
  mode: 'MANUAL' | 'LIVE_RATES' | 'HYBRID'
  hasOriginAddress: boolean
  hasDefaultPackage: boolean
  hasManualRates: boolean
  hasProvider: boolean
  providerConnected: boolean
  canUseManualRates: boolean
  canUseLiveRates: boolean
  canBuyLabels: boolean
  warnings: string[]
  nextSteps: string[]
}
```

### Acceptance Criteria

- Wizard saves each step.
- Wizard can resume from saved state.
- Wizard shows missing steps.
- Manual setup works without provider.
- Hybrid setup requires both provider and fallback rates.

---

## Phase 3 — Provider Connection Layer

### Goal

Allow merchants to connect EasyPost or Shippo for live rates and labels.

### Storage

Use existing models:

- `Integration`
- `IntegrationSecret`

Suggested integration types:

```txt
SHIPPING_EASYPOST
SHIPPING_SHIPPO
```

Store provider credentials in `IntegrationSecret` using the existing secret/encryption pattern.

### Service Files

Create:

```txt
src/server/shipping/shipping-provider.service.ts
src/server/shipping/providers/easypost.ts
src/server/shipping/providers/shippo.ts
```

### API

```txt
POST /api/settings/shipping/connect-provider
POST /api/settings/shipping/disconnect-provider
POST /api/settings/shipping/test-provider
```

Rules:

- Use `requireAdmin(req)`.
- Never return saved credentials.
- Return only provider status and test result.

### Acceptance Criteria

- Merchant can connect EasyPost.
- Merchant can connect Shippo.
- Merchant can test the connection.
- Manual shipping still works with no provider.

---

## Phase 4 — Normalized Rate Service

### Goal

Create one internal shipping-rate service for manual, EasyPost, and Shippo rates.

### File

```txt
src/server/shipping/shipping-rate.service.ts
```

### Normalized Shape

```ts
type ShippingRateQuote = {
  id: string
  source: 'MANUAL' | 'EASYPOST' | 'SHIPPO'
  carrier?: string
  service?: string
  displayName: string
  amountCents: number
  currency: string
  estimatedDays?: number
  providerRateId?: string
  metadata?: Record<string, unknown>
}
```

### Logic

```txt
MANUAL:
  return Doopify built-in rates

LIVE_RATES:
  return provider rates or a clear setup/error response

HYBRID:
  try provider rates first
  fall back to manual rates if provider fails
```

### Acceptance Criteria

- Manual rates return normalized quotes.
- Provider rates return normalized quotes.
- Hybrid mode falls back safely.
- Checkout and admin do not depend on provider-specific response shapes.

---

## Phase 5 — Checkout Shipping Rate Selection

### Goal

Allow checkout to request shipping options and charge the selected server-validated rate.

### API

```txt
POST /api/checkout/shipping-rates
```

Rules:

- Public checkout route.
- Do not trust client totals.
- Re-fetch product and variant data from Prisma.
- Validate product status and inventory.
- Build package server-side.
- Return safe `ShippingRateQuote[]`.

### Payment Intent Flow

When creating the PaymentIntent:

- Browser may send selected shipping quote id.
- Server must revalidate the selected rate.
- Server calculates final total.
- Stripe amount uses server-calculated cents.

### Checkout Snapshot

Persist selected shipping information in checkout payload:

```ts
selectedShippingRate: {
  source: 'MANUAL' | 'EASYPOST' | 'SHIPPO'
  carrier?: string
  service?: string
  displayName: string
  amountCents: number
  currency: string
  estimatedDays?: number
  providerRateId?: string
}
```

### Acceptance Criteria

- Checkout displays manual shipping options.
- Checkout displays live shipping options when configured.
- Hybrid mode falls back to manual rates.
- Server validates selected shipping before payment amount.
- Stripe webhook finalization remains unchanged.

---

## Phase 6 — Manual Fulfillment

### Goal

Allow merchants to fulfill an order without buying a label through Doopify.

### Order Page Button

```txt
Mark Fulfilled Manually
```

### Fields

- selected items
- carrier
- service
- tracking number
- tracking URL
- shipped date
- send tracking email if supported

### API

```txt
POST /api/orders/[orderId]/manual-fulfillment
```

Rules:

- Use `requireAdmin(req)`.
- Validate order exists.
- Validate selected items belong to order.
- Validate quantities do not exceed unfulfilled quantity.
- Create `Fulfillment`.
- Create `FulfillmentItem` rows.
- Update order fulfillment status.
- Add `OrderEvent`.
- Do not call EasyPost or Shippo.
- Do not change payment totals.

### Acceptance Criteria

- Merchant can manually fulfill paid orders.
- Tracking data saves.
- Order fulfillment status updates.
- Works without provider connection.

---

## Phase 7 — Label Purchase And Printing

### Goal

Allow merchants to buy a label from the order page and print/download it.

### Add Model

```prisma
model ShippingLabel {
  id                 String   @id @default(cuid())
  fulfillmentId      String?
  orderId            String
  provider           String
  providerShipmentId String?
  providerRateId     String?
  providerLabelId    String?
  carrier            String?
  service            String?
  status             String   @default("PURCHASED")
  labelUrl           String?
  labelFormat        String?
  trackingNumber     String?
  trackingUrl        String?
  rateAmountCents    Int?
  labelAmountCents   Int?
  currency           String   @default("USD")
  rawResponse         Json?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([orderId])
  @@index([fulfillmentId])
  @@index([provider, providerLabelId])
  @@map("shipping_labels")
}
```

### API

```txt
POST /api/orders/[orderId]/shipping-rates
POST /api/orders/[orderId]/shipping-labels
```

### Buy Label Rules

- Use `requireAdmin(req)`.
- Validate order is paid.
- Validate selected items belong to order.
- Validate package data.
- Buy provider label.
- Persist `ShippingLabel`.
- Create/update `Fulfillment` with label/tracking fields.
- Create `FulfillmentItem` rows.
- Update fulfillment status.
- Add `OrderEvent`.
- Do not charge the customer.
- Do not change order totals.
- Avoid duplicate label purchases on retry.

### Admin UI

Order page button:

```txt
Buy Shipping Label
```

Modal steps:

1. Select items
2. Select package
3. Get rates
4. Choose rate
5. Buy label
6. Print/download label

Printing rule:

- Provider returns `labelUrl`.
- Admin opens/downloads `labelUrl`.
- Server does not directly print.

MVP label format:

```txt
PDF 4x6
```

### Acceptance Criteria

- Merchant can get label rates on order page.
- Merchant can buy label.
- `ShippingLabel` is created.
- `Fulfillment` stores carrier, service, tracking, and label URL.
- Print/download label works.
- Order totals stay unchanged.

---

## Phase 8 — Tracking Jobs

### Goal

Use the `Job` system for tracking updates and later provider sync.

### Current Foundation

- `fulfillment.created` now queues `SYNC_SHIPPING_TRACKING` and opt-in `SEND_FULFILLMENT_EMAIL` jobs.
- `SEND_FULFILLMENT_EMAIL` uses tracked `EmailDelivery` records (`fulfillment_tracking` template) so send success/failure is observable and retryable.
- `SYNC_SHIPPING_TRACKING` performs safe fulfillment tracking backfill, provider tracking polling, `PENDING -> OPEN` promotion, and delivery confirmation updates that can set `Fulfillment.deliveredAt`.
- Shipping provider webhooks are now ingested at `POST /api/webhooks/shipping-provider?provider=EASYPOST|SHIPPO` to update fulfillment/label tracking state and queue sync follow-up jobs.

### Job Types

```txt
SYNC_SHIPPING_TRACKING
SEND_FULFILLMENT_EMAIL
```

### Rules

- Tracking sync failure should retry safely.
- Tracking sync must not change payment totals.
- Delivered tracking can update `Fulfillment.deliveredAt`.
- Add `OrderEvent` for important tracking changes.

---

## Phase 9 — Later Features

Do not build in MVP unless explicitly requested:

- void label
- refund label
- return labels
- customs forms
- insurance
- signature confirmation
- bulk label purchase
- packing slips
- tracking webhooks

---

## Recommended MVP Sequence

Build in this order:

1. Manual shipping tab
2. Setup wizard
3. Provider connection
4. Normalized rate service
5. Manual fulfillment
6. Label purchase and print/download
7. Live checkout shipping rates
8. Tracking jobs
9. Return labels and bulk labels later

This keeps checkout safe while still delivering real merchant value quickly.

## Verification

Run after each phase:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

For database-heavy work, also run:

```bash
npm run test:integration
```

## Documentation Updates

Update `docs/HARDENING.md` with shipping invariants.

Update `docs/CONTRIBUTING.md` with shipping provider secret and checkout validation rules.

Update `docs/features-roadmap.md` as each phase ships.
