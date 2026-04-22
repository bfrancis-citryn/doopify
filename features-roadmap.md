# Doopify — Features Roadmap

> **Single source of truth** for what's built, what's next, and what ships after. Replaces the former `ROADMAP.md`, `DOOPIFY_COMMERCE_PLAN.md`, `DOOPIFY_IMPLEMENTATION_PHASES.md`, `DOOPIFY_NEXT_PHASE.md`, and `DOOPIFY_ORDER_SYSTEM_ARCHITECTURE.md`.
>
> **Last updated:** April 21, 2026
> **Aesthetic direction:** Modern SaaS (Linear / Vercel)
> **Scope:** Admin backend, storefront, and shared commerce core.

---

## Table of Contents

1. [Current State — What's Built](#current-state--whats-built)
2. [Guiding Principles](#guiding-principles)
3. [Design System Foundations](#design-system-foundations)
4. [Phase 0 — Quick Wins (this week)](#phase-0--quick-wins-this-week)
5. [Phase 1 — Revenue Loop (weeks 1–2)](#phase-1--revenue-loop-weeks-12)
6. [Phase 2 — Shopify Parity Essentials (weeks 3–5)](#phase-2--shopify-parity-essentials-weeks-35)
7. [Phase 3 — Operational Depth (weeks 6–9)](#phase-3--operational-depth-weeks-69)
8. [Phase 4 — Differentiation & Scale (weeks 10+)](#phase-4--differentiation--scale-weeks-10)
9. [Cross-Cutting Features](#cross-cutting-features)
10. [Prisma Schema Additions](#prisma-schema-additions)
11. [Definition of Done](#definition-of-done)

---

## Current State — What's Built

> Audited directly from the repo on April 21, 2026.

### Implemented

| Area | Status | Notes |
|------|--------|-------|
| **Prisma schema** | Done | 23 models including `Store`, `User`, `Session`, `Product`, `ProductVariant`, `ProductOption`, `MediaAsset`, `ProductMedia`, `Collection`, `CollectionProduct`, `Customer`, `CustomerAddress`, `Order`, `OrderItem`, `OrderAddress`, `OrderEvent`, `Payment`, `Fulfillment`, `FulfillmentItem`, `Refund`, `Return`, `Discount`, `DiscountApplication` |
| **Auth & session** | Done | JWT cookie (`doopify_token`); routes at `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` |
| **Route protection** | Done | `src/proxy.ts` guards admin pages + private APIs |
| **Admin pages** | Done | `/admin`, `/analytics`, `/customers`, `/discounts`, `/draft-orders`, `/media`, `/orders`, `/products`, `/settings` |
| **Admin APIs** | Done | `/api/analytics`, `/api/customers`, `/api/discounts`, `/api/media`, `/api/orders`, `/api/products`, `/api/settings` |
| **Service layer** | Partial | `src/server/services/` has `auth`, `customer`, `order`, `product`. Others (`discount`, `media`, `settings`, `analytics`) still live in route handlers — candidates for extraction. |
| **Storefront** | Partial | `/`, `/shop`, `/shop/[handle]` read from live catalog via `/api/storefront/products` |
| **Media library** | Done | Upload, browse, alt-text edit, delete, linked-product visibility at `/media` and `/api/media/*` |
| **Product editor** | Done | CRUD with variants, options, media gallery, storefront sync |

### In Prisma schema but UI / API not built yet

| Model | What's missing |
|-------|----------------|
| `Collection` / `CollectionProduct` | No admin CRUD UI, no `/api/collections/*`, no storefront `/collections/[handle]` route |
| `Refund` | Model exists; no refund workflow UI, no Stripe refund integration |
| `Return` | Model exists; no RMA workflow, no status transitions |
| `Discount` / `DiscountApplication` | Admin lists discounts; storefront checkout application isn't wired |
| `OrderEvent` | Populated on order mutations; no timeline UI reads it yet |

### Not started

- `/checkout` storefront route
- Stripe payment intent creation + webhook order creation
- Inventory decrement on paid order
- Draft-order database persistence (currently UI-only)
- Transactional email (order confirmation, shipping, refund, password reset)
- Customer account portal (`/account`, `/account/orders/[orderNumber]`)
- Role-based permission enforcement (current auth is "valid session exists")
- Login rate limiting

---

## Guiding Principles

- **Ship merchant value fastest.** Every phase unlocks a visible outcome for a shop owner, not an internal refactor.
- **Prisma is the single source of truth.** No feature ships without its model landing in `prisma/schema.prisma` first.
- **Thin controllers, fat services.** Route handlers under `src/app/api/*` validate + dispatch; business logic lives in `src/server/services/*`.
- **Every money/stock/customer action gets a confirmation, an undo, and an audit-log entry.**
- **Token-first styling.** No raw hex in components — use semantic CSS variables so dark mode ships for free.
- **Headless discipline.** Frontend never touches the DB. All reads/writes go through `/app/api/*` routes.

---

## Design System Foundations

> Ship this **before** building individual tabs. Everything downstream depends on it.

### Type scale

| Role | Font | Size | Usage |
|------|------|------|-------|
| Display | Geist / Söhne | 32 / 26 / 22 px | Page titles, empty-state headlines |
| Body | Inter / Geist | 14 px base, 13 px compact | Form copy, long-form |
| Numeric | JetBrains Mono + `font-variant-numeric: tabular-nums` | Matches body | Prices, counts, IDs |
| Eyebrow | Body font, uppercase, +60 tracking | 10–11 px | Section labels, chip text |

### Color tokens (CSS variables)

```css
:root {
  --bg:         #ffffff;
  --surface:    #f6f6f8;
  --surface-2:  #fbfbfc;
  --border:     #e4e4e7;
  --ink:        #0a0a0a;
  --ink-soft:   #52525a;
  --accent:     #5b5bf2;
  --success:    #108a56;
  --warning:    #b45309;
  --danger:     #b42525;
}

[data-theme="dark"] {
  --bg:         #0a0a0a;
  --surface:    #141416;
  --surface-2:  #1c1c1f;
  --border:     #26262b;
  --ink:        #f4f4f5;
  --ink-soft:   #a1a1aa;
  --accent:     #7c7cf5;
  --success:    #22c55e;
  --warning:    #f59e0b;
  --danger:     #ef4444;
}
```

### Spatial system

- **Base grid:** 8-point with 4-point sub-grid.
- **Page gutters:** 24 px. **Card padding:** 20–24 px. **Form row gutter:** 16 px.
- **Spacing scale:** `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`. Don't invent numbers.

### Shared components (build once, use everywhere)

- [ ] Command palette (⌘K) — fuzzy search across products, orders, customers, settings
- [ ] Slide-over drawer (edit product / refund order / inspect customer without losing list context)
- [ ] Data table primitives (sortable, filterable, paginated, virtualized ≥ 50 rows)
- [ ] Persistent filter bar with saved views
- [ ] Toast system with Undo (6-second window for destructive actions)
- [ ] Skeleton loaders (anywhere route > 300 ms)
- [ ] Empty states with one primary action
- [ ] Keyboard shortcuts overlay (press `?`)

---

## Phase 0 — Quick Wins (this week)

> Low-effort, high-impact. Unblocks everything downstream.

| Item | Why now | Effort |
|------|---------|--------|
| Design tokens + dark mode | Whole-product perceived quality uplift | 2–3 days |
| Command palette (⌘K) | Outsized power-user wow factor | 2 days |
| Duplicate product + inline row edits on `/products` | Daily friction crusher | 1 day |
| Order & product **Tags** (real model, not free text) | Unlocks filters + automation | 1 day |
| Order notes (internal + customer-visible) | Trivial, often requested | 0.5 day |
| Brand kit screen (logo, color, fonts) under `/settings/brand` | Drives consistency across emails + storefront | 1 day |
| Toast + Undo system | Prevents 90% of "I just accidentally..." tickets | 1 day |
| Extract `discount`, `media`, `settings`, `analytics` services out of route handlers | Align with existing `auth / customer / order / product` pattern | 1 day |

---

## Phase 1 — Revenue Loop (weeks 1–2)

> **The single highest-leverage phase.** Without checkout, the store cannot convert traffic. Do this before parity work.

### 1.1 Storefront checkout

- Add `/checkout` route under `src/app/shop/checkout/page.tsx` (or top-level `/checkout`).
- Cart → checkout handoff: pass line items + customer email + shipping address.
- Address form with validation and required fields.
- Order summary (line items, subtotal, tax, shipping, total).
- "Place order" button wired to the Stripe PaymentIntent creation route below.

### 1.2 Stripe integration

- `POST /api/checkout/intent` — creates a Stripe PaymentIntent using cart + shipping + tax.
- Stripe Elements (`@stripe/react-stripe-js`) on the checkout page for card, Apple Pay, Google Pay, Link.
- `POST /api/webhooks/stripe` — receives `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.
- Raw-body parsing + signature verification.
- **Webhook is the source of truth for order creation** — not the browser redirect.

### 1.3 Order creation via webhook

- On `payment_intent.succeeded`:
  1. Create `Order` with `PaymentStatus.PAID`.
  2. Create `Payment` linked to the PaymentIntent.
  3. Create `OrderItem` rows.
  4. Create `OrderAddress` rows (shipping + billing).
  5. Atomically decrement `ProductVariant` inventory (Prisma transaction).
  6. Create `OrderEvent` entries: `order.created`, `payment.received`.
  7. Enqueue the confirmation email (see 1.5).
- On `payment_intent.payment_failed`: create a failed-payment `OrderEvent` for the abandoned checkout if one exists; no order created.

### 1.4 Inventory safety

- Inventory check at PaymentIntent creation — reject if any variant's available stock is less than requested.
- Optimistic reservation: decrement `committed` at PaymentIntent create, finalize on webhook success, release on failure/expiry.

### 1.5 Order confirmation email

- Use React Email (`@react-email/components`) + Resend (or Postmark).
- Template: `OrderConfirmation.tsx`.
- Enqueue via a simple jobs table or inline `await` for now (queue can come later).
- Send-test-to-me button in `/settings/notifications`.

### 1.6 Draft-order persistence

- Replace UI-only draft state with real `DraftOrder` model.
- `/api/draft-orders` CRUD.
- "Send invoice" button → emails customer a hosted Stripe Checkout link.
- "Convert to order" → creates an order on behalf of the customer (staff-side flow).

---

## Phase 2 — Shopify Parity Essentials (weeks 3–5)

### 2.1 Collections (models exist — UI does not)

- Admin CRUD at `/admin/collections` — list, create, edit, delete.
- **Manual** (drag products in via `CollectionProduct` table) and **Smart** (rules like `tag contains`, `price <`, `vendor =`, `product_type =`).
- Rules stored as JSON on the `Collection` model; materialize smart membership via a background job + revalidate hook.
- Per-collection SEO fields (title, description, image).
- Storefront routes: `/shop/collections`, `/shop/collections/[handle]`.
- API: `/api/collections` + `/api/storefront/collections`.

### 2.2 Product variants matrix editor

- `ProductOption` + `ProductOptionValue` already exist. Build the generator UI that turns option axes (Size × Color × Material) into a full `ProductVariant` grid.
- Per-variant price, compare-at, SKU, barcode, weight, inventory policy, image.
- Bulk-edit a column ("all XL variants +$5").

### 2.3 Bundles

- Add `Bundle` + `BundleItem` models (see Schema Additions).
- Two modes: **Fixed** (specific variants at bundle price) and **BYO** (pick N items from collection X).
- Stock deducts from components on order creation.
- Admin UI under `/products/bundles`.

### 2.4 SEO panel (per product + collection + page)

- Title tag, meta description with live Google preview + char counter.
- Canonical URL override, OG image override, structured-data toggle.
- Auto-generate defaults from entity data.

### 2.5 CSV import / export

- Shopify-compatible columns so migration is one-click.
- Background job with progress bar + error-report CSV.
- Products and orders both supported.

### 2.6 Stripe setup wizard (in Settings)

> You explicitly called this out. Three-step guided flow.

1. **Connect** — Stripe OAuth "Connect with Stripe" button.
2. **Verify** — auto-fetch account, show business name / country / currency; confirm step.
3. **Test** — run a $0.50 test charge + refund against the live account to prove wiring. Show a tick next to each capability (cards, Apple Pay, Link).
- Finish with "Enable test mode" toggle and a "Go live" button.
- Store credentials in `PaymentGatewayAccount` (encrypted).

### 2.7 Custom domain + SSL

- Enter domain → show exact DNS records (A for apex, CNAME for subdomain).
- Poll DNS every 30s; auto-provision Let's Encrypt via ACME when propagation detected.

### 2.8 Shipping zones + rates

- Zone = country list; rate types: flat, by weight, by price, free over $X.
- Rates can be restricted by product collection.
- Live "test a ZIP" widget.

### 2.9 Taxes

- Default to Stripe Tax (when connected) or TaxJar.
- Manual override table by region.
- Tax-inclusive vs. tax-exclusive pricing toggle.
- Per-product tax class.

### 2.10 Email templates (transactional)

- Templates: order confirmation, shipping, refund, abandoned cart, password reset, invoice.
- Inline rich-text editor with variable chips (`{{customer_name}}`, `{{order_number}}`).
- "Send test to me" button per template.

### 2.11 Checkout customization

- Field toggles (company name, phone, delivery note).
- Address format (US vs. international).
- Logo + accent color.
- Attach terms / privacy / refund policies as footer links.
- Live preview pane.

### 2.12 Staff accounts + RBAC

- Role presets: Owner, Admin, Staff, Fulfillment-only, Finance-only (upgrade existing `UserRole` enum: `OWNER`, `STAFF`, `VIEWER`).
- Permissions matrix on the `Role` model.
- Email invites with 24h expiring link.
- **Enforcement** at `proxy.ts` + per-route guard.
- Login rate limiting (see §2.13).

### 2.13 Security hardening

- Login rate limiting (e.g., 10 attempts / 15 min / IP).
- Stricter cookie flags (`Secure`, `HttpOnly`, `SameSite=Lax`, production `__Host-` prefix).
- Audit headers (CSP, HSTS, Referrer-Policy).

### 2.14 Legal pages / policies

- Built-in editors for privacy, terms, refund, shipping.
- Markdown/rich-text.
- Auto-link from checkout + storefront footer.

---

## Phase 3 — Operational Depth (weeks 6–9)

### 3.1 Returns / RMA (model exists — workflow does not)

- Dedicated sub-tab under `/orders` or top-level `/returns`.
- Admin or customer initiates → pick items + reason → prepaid label or instructions.
- Status workflow: `requested → approved → in_transit → received → refunded`.
- Populate `OrderEvent` for each transition.

### 3.2 Partial fulfillments + multi-shipment

- `Fulfillment` + `FulfillmentItem` already exist. Build the flow that lets one order have multiple fulfillments with independent carriers / tracking / locations.
- Order fulfillment status derived from children.

### 3.3 Refunds: line-item with restock

- `Refund` model exists. Build slide-over UI on the order detail page.
- Refund by line-item × qty, with or without restock.
- Tax-aware recalculation.
- Call Stripe's refund API; persist `stripeRefundId`.

### 3.4 Abandoned checkouts

- Add `AbandonedCheckout` model.
- Capture carts with email but no successful payment (via the failed-payment webhook branch).
- Auto-send recovery email after N hours (configurable).
- Track recovered revenue in an analytics card.

### 3.5 Customer account portal

- `/account`, `/account/orders`, `/account/orders/[orderNumber]`, `/account/addresses`, `/account/profile`.
- Customer auth: magic-link or password-based (separate from staff auth).
- Customer can see tracking, invoice PDF, reorder, request return.

### 3.6 Insights dashboard (home page)

- Sign-in lands on dashboard: today's GMV, order count, conversion rate, top products.
- Compare-to-previous-period deltas.
- Each card links into the relevant filtered view.

### 3.7 Customer 360

- Per-customer page: lifetime spend, order count, AOV, first/last order, abandoned carts.
- Merged timeline across orders + notes + emails.

### 3.8 Media library → object storage

- Currently stores binaries in `MediaAsset.data` (Postgres bytea). Fine for dev.
- Move to S3 or Cloudflare R2 for production: store `url` + `key`, serve via signed URLs.
- Migration script to backfill existing assets.
- Add CDN in front for delivery.

### 3.9 Inventory & locations

- Add `Location` + `InventoryLevel` models (see Schema).
- Variant inventory tracked per location.
- Stock transfers, adjustments with reasons.
- Foundation for multi-warehouse shipping in Phase 4.

### 3.10 Digital products + downloads

- `isDigital` flag on `Product`.
- Signed, time-limited download URLs in order confirmation email.
- Download count per customer.

### 3.11 API keys + webhooks (outgoing)

- Generate / rotate keys with scoped permissions.
- Outgoing webhook subscriptions: `order.created`, `order.paid`, `fulfillment.created`, `refund.created`.
- Delivery log (status, latency, response body).
- Replay failed deliveries.
- "Test payload" button.

### 3.12 Audit log

- Add `AuditLogEntry` model.
- System-wide event feed: logins, setting changes, product edits, refunds, role changes.
- Filterable by actor / resource / date.

### 3.13 Import from Shopify

- Drop a Shopify CSV export (`products.csv`, `customers.csv`, `orders.csv`).
- Column mapper → preview → import with progress.

### 3.14 SEO & launch hardening

- Dynamic sitemap generation at `/sitemap.xml`.
- `robots.txt` with environment-aware rules.
- Per-page structured data (Product, Breadcrumb, Organization).
- Error reporting (Sentry) + request-level monitoring.

---

## Phase 4 — Differentiation & Scale (weeks 10+)

### 4.1 Product metafields

- Arbitrary structured data per product (`Metafield` model — key / type / value JSON).
- Types: text, number, boolean, JSON, file, reference.
- Storefront can query by metafield for custom product pages.

### 4.2 Automation rules

- If-this-then-that for operations: "order tagged VIP → Slack ping", "inventory < 5 → email me".
- Visual rule builder.

### 4.3 Shipping label printing

- Integrate Shippo or EasyPost.
- Buy rate → print 4×6 label PDF → push tracking back to the order.

### 4.4 Fraud / risk scoring

- Surface AVS / CVV / IP-billing distance / email-domain-age.
- Stripe Radar score when Stripe is wired.
- Manual "approved for fulfillment" flag.

### 4.5 Subscriptions & recurring billing

- Subscription plan model (interval, trial, price).
- Pause / skip / cancel self-serve for customers.
- Stripe Billing integration.

### 4.6 Billing / plan (multi-tenant prep)

- Plan name, usage (orders/month, GB storage), next invoice preview.
- Stub now even while single-tenant.

### 4.7 Backup & export

- One-click "Export everything" ZIP.

### 4.8 Public Apps / plugin system

- Registered apps with OAuth-style scoped API access.
- Merchant-installable.

---

## Cross-Cutting Features

| Feature | Phase | Notes |
|---------|-------|-------|
| Command palette (⌘K) | Phase 0 | Fuzzy index across products, orders, customers, settings |
| Dark mode | Phase 0 | Ship with design tokens |
| Global search | Phase 2 | Full-text across everything with grouped results |
| Notifications center | Phase 3 | Bell: new orders, low-stock, failed webhooks |
| Onboarding checklist | Phase 2 | "X of 7 steps" bar in top nav until store is sale-ready |
| Keyboard shortcuts overlay | Phase 0 | `?` opens cheat sheet |
| 2FA + session management | Phase 2 | TOTP, active sessions list with revoke |
| Responsive admin (≥ 768px) | Phase 3 | Full feature set ≥ 1024px; orders + notifications on tablet |
| Audit log | Phase 3 | See §3.12 |

---

## Prisma Schema Additions

> Models/fields to add. Existing models (`Store`, `User`, `Product`, `ProductVariant`, `Collection`, etc.) stay — these are the gaps.

### Products

```prisma
model Tag {
  id         String   @id @default(cuid())
  name       String
  slug       String
  storeId    String
  products   ProductTag[]
  orders     OrderTag[]
  customers  CustomerTag[]
  @@unique([storeId, slug])
  @@index([storeId])
}

model ProductTag {
  productId String
  tagId     String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([productId, tagId])
}

model Bundle {
  id               String   @id @default(cuid())
  storeId          String
  name             String
  price            Int      // cents
  compareAtPrice   Int?
  description      String?
  imageId          String?
  items            BundleItem[]
  @@index([storeId])
}

model BundleItem {
  id        String  @id @default(cuid())
  bundleId  String
  variantId String
  qty       Int
  bundle    Bundle  @relation(fields: [bundleId], references: [id], onDelete: Cascade)
}

model Location {
  id         String   @id @default(cuid())
  storeId    String
  name       String
  address    Json
  isDefault  Boolean  @default(false)
  inventory  InventoryLevel[]
  @@index([storeId])
}

model InventoryLevel {
  id          String   @id @default(cuid())
  variantId   String
  locationId  String
  onHand      Int      @default(0)
  committed   Int      @default(0)
  @@unique([variantId, locationId])
  @@index([locationId])
}

model Metafield {
  id         String   @id @default(cuid())
  ownerType  String   // "product" | "variant" | "order" | "customer" | ...
  ownerId    String
  namespace  String
  key        String
  type       String   // "text" | "number" | "boolean" | "json" | "file" | "reference"
  value      Json
  @@unique([ownerType, ownerId, namespace, key])
  @@index([ownerType, ownerId])
}

// Fields to add on existing Product:
//   publishedAt      DateTime?
//   isDigital        Boolean  @default(false)
//   digitalFileId    String?
//   vendor           String?
//   productType      String?
//   seoTitle         String?
//   seoDescription   String?

// Fields to add on existing ProductVariant:
//   weightGrams      Int?
//   inventoryPolicy  String   @default("deny") // "deny" | "continue"
//   requiresShipping Boolean  @default(true)
//   taxClass         String   @default("standard")
```

### Orders & customers

```prisma
model OrderTag {
  orderId String
  tagId   String
  @@id([orderId, tagId])
}

model CustomerTag {
  customerId String
  tagId      String
  @@id([customerId, tagId])
}

model DraftOrder {
  id         String   @id @default(cuid())
  storeId    String
  customerId String?
  lineItems  Json
  subtotal   Int
  tax        Int
  shipping   Int
  total      Int
  status     String   @default("draft")
  invoiceUrl String?
  @@index([storeId])
}

model AbandonedCheckout {
  id           String   @id @default(cuid())
  storeId      String
  email        String
  cart         Json
  recoveryUrl  String
  recoveredAt  DateTime?
  createdAt    DateTime @default(now())
  @@index([storeId, recoveredAt])
}

model OrderNote {
  id          String   @id @default(cuid())
  orderId     String
  body        String
  visibility  String   // "internal" | "customer"
  authorId    String
  createdAt   DateTime @default(now())
  @@index([orderId])
}
```

### Settings & platform

```prisma
model Domain {
  id          String   @id @default(cuid())
  storeId     String
  host        String
  isPrimary   Boolean  @default(false)
  sslStatus   String   @default("pending")
  verifiedAt  DateTime?
  @@index([storeId])
}

model PaymentGatewayAccount {
  id             String   @id @default(cuid())
  storeId        String
  provider       String   // "stripe" | "paypal" | ...
  credentialsEnc String
  mode           String   // "test" | "live"
  capabilities   Json
  @@index([storeId])
}

model ShippingZone {
  id         String   @id @default(cuid())
  storeId    String
  name       String
  countries  Json
  rates      ShippingRate[]
  @@index([storeId])
}

model ShippingRate {
  id       String   @id @default(cuid())
  zoneId   String
  name     String
  type     String   // "flat" | "by_weight" | "by_price"
  config   Json
  minValue Int?
  maxValue Int?
}

model TaxRate {
  id              String   @id @default(cuid())
  storeId         String
  region          String
  rate            Decimal  @db.Decimal(6, 4)
  productTaxClass String   @default("standard")
  isInclusive     Boolean  @default(false)
  @@index([storeId, region])
}

model EmailTemplate {
  id         String   @id @default(cuid())
  storeId    String
  key        String
  subject    String
  html       String
  variables  Json
  updatedAt  DateTime @updatedAt
  @@unique([storeId, key])
}

model Role {
  id           String   @id @default(cuid())
  name         String
  permissions  Json
}

model ApiKey {
  id          String   @id @default(cuid())
  storeId     String
  prefix      String
  secretHash  String
  scopes      Json
  lastUsedAt  DateTime?
  revokedAt   DateTime?
  @@index([storeId])
}

model Webhook {
  id         String   @id @default(cuid())
  storeId    String
  url        String
  topics     Json
  secret     String
  isActive   Boolean  @default(true)
  deliveries WebhookDelivery[]
  @@index([storeId])
}

model WebhookDelivery {
  id           String   @id @default(cuid())
  webhookId    String
  status       String
  latencyMs    Int?
  responseCode Int?
  payload      Json
  createdAt    DateTime @default(now())
  @@index([webhookId, createdAt])
}

model AuditLogEntry {
  id            String   @id @default(cuid())
  storeId       String
  actorId       String?
  action        String
  resourceType  String
  resourceId    String
  diff          Json?
  createdAt     DateTime @default(now())
  @@index([storeId, createdAt])
  @@index([resourceType, resourceId])
}

model OnboardingStep {
  id           String    @id @default(cuid())
  storeId      String
  key          String
  completedAt  DateTime?
  @@unique([storeId, key])
}
```

### Schema hygiene

- Add indexes on every foreign key.
- Add `(storeId, createdAt DESC)` on high-traffic tables (`Order`, `Product`).
- Use Prisma middleware for **soft-deletes** on `Product`, `Customer`, `Order` — never lose history.
- Always `@@index` fields used in `where` clauses.

---

## Definition of Done

A feature ships when:

- [ ] Prisma model migration is applied (`npm run db:push` or `prisma migrate dev`).
- [ ] API route exists under `src/app/api/*` with Zod validation.
- [ ] Service layer in `src/server/services/*` owns business logic (not the route handler).
- [ ] Frontend consumes the API — **never** direct Prisma calls from UI code.
- [ ] Response contract: `{ success: true, data }` or `{ success: false, error }`.
- [ ] Destructive actions have confirmation + undo.
- [ ] An `AuditLogEntry` is written for money/stock/customer changes.
- [ ] Empty, loading, and error states are all designed.
- [ ] Keyboard-accessible with visible focus rings.
- [ ] Contrast ≥ 4.5:1 in both light and dark mode.
- [ ] Responsive from 375px to 1440px.
- [ ] At least one unit test for the service and one integration test for the API route.

---

## Closing principle

> Shopify is 5,000 engineers shipping since 2006. You won't out-scope them. You **can** out-polish them on the surfaces merchants touch daily — a faster table, a better command palette, a cleaner settings UX, and dark mode that actually looks good.
>
> But polish comes after the revenue loop exists. Ship Phase 1 first.
