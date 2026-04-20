# Doopify — Launch Roadmap

> A complete pre-launch breakdown covering every system, integration, and security requirement
> needed to turn Doopify from a polished admin demo into a production-grade headless commerce platform.

**Stack:** Next.js 16 · Prisma · PostgreSQL · Stripe  
**Phases:** 8 total  
**Estimated launch:** 10–14 weeks

---

## Current State

### What exists today

| Area | Status | Notes |
|------|--------|-------|
| Admin UI — 7 modules | ✅ Built | Orders, Products, Customers, Draft Orders, Discounts, Analytics, Settings |
| Product editor | ✅ Solid | Variants, media, autosave, SKU validation, status management |
| Dark / light theme | ✅ Done | CSS vars, localStorage, system preference |
| Login UI | ✅ UI only | Calls `/api/auth/login` — that endpoint does not exist |
| Database / Prisma | ❌ Missing | No schema, no PostgreSQL, no migrations |
| API routes | ❌ Missing | Zero backend routes. All data is React Context in-memory |
| Authentication | ❌ Missing | Any URL is publicly accessible. No session, no JWT, no middleware |
| Storefront | ❌ Missing | No customer-facing shop exists at all |
| TypeScript | ⚠️ Missing | Entire codebase is plain JS — spec requires TS |
| Image upload | ⚠️ UI only | Media manager UI exists, no upload endpoint, no cloud storage |

**Core gap:** Every action in the admin — creating a product, saving an order, adding a customer — only updates React state that disappears on refresh. Connecting a real backend is the entire job before launch.

---

## Launch Readiness

| Domain | Readiness |
|--------|-----------|
| Admin UI / Components | ~85% |
| Database / Prisma Schema | 0% |
| Backend API Routes | 0% |
| Authentication System | ~10% (UI only) |
| Storefront / Public Shop | 0% |
| Checkout / Stripe | 0% |
| Media / File Upload | ~15% (UI only) |
| Email Notifications | 0% |
| Security / Route Protection | 0% |
| **Overall** | **~18%** |

---

## Phase 1 — Foundation

> Blocks everything else. Nothing in phases 2–8 can happen until this is done.

### 1.1 — Environment Setup (Est: 1 day)

- [ ] Copy values from `.env.example` into local env files — keep `DATABASE_URL` and `DIRECT_URL` in `.env`, and keep `JWT_SECRET`, `NEXT_PUBLIC_*`, Stripe, Cloudinary, and Resend secrets in `.env.local`
- [ ] Provision PostgreSQL — recommended: **Neon** (free tier, serverless) or **Supabase**
- [ ] Install Prisma: `npm install prisma @prisma/client`
- [ ] Initialize Prisma: `npx prisma init`
- [ ] Migrate codebase to TypeScript — install `typescript`, `@types/react`, `@types/node`, rename `.js` → `.tsx` / `.ts`
- [ ] Install auth + validation libraries: `npm install bcryptjs jsonwebtoken zod`
- [ ] Install SWR for data fetching: `npm install swr`

### 1.2 — Prisma Schema — Full Data Model (Est: 2–3 days)

Build the complete schema. This is the single source of truth for all data in Doopify.

- [ ] **Store** — name, domain, currency, timezone, branding colors, logoUrl
- [ ] **User** — email, passwordHash, role (`OWNER | STAFF | VIEWER`), isActive, lastLoginAt
- [ ] **Session** — token, userId, expiresAt, createdAt, ip, userAgent
- [ ] **Product** — title, handle (slug), status (`ACTIVE | DRAFT | ARCHIVED`), description, vendor, tags
- [ ] **ProductVariant** — productId, title, sku, price, compareAtPrice, inventory, weight
- [ ] **ProductOption** — productId, name (e.g. Size, Color) with ProductOptionValue join table
- [ ] **MediaAsset** — url, altText, mimeType, size, width, height, storageKey, position
- [ ] **Collection** — title, handle, description, sortOrder, rules (manual or automated)
- [ ] **Customer** — email, firstName, lastName, phone, acceptsMarketing, tags, defaultAddressId
- [ ] **CustomerAddress** — customerId, firstName, lastName, address1, city, province, postalCode, country, isDefault
- [ ] **Order** — orderNumber, customerId, status, paymentStatus, fulfillmentStatus, subtotal, tax, shipping, total, note, channel
- [ ] **OrderItem** — orderId, variantId, title, sku, price, quantity, totalDiscount
- [ ] **OrderAddress** — orderId, type (`shipping | billing`), full address fields
- [ ] **Payment** — orderId, provider, amount, currency, status, stripePaymentIntentId
- [ ] **Fulfillment** — orderId, status, carrier, service, trackingNumber, labelUrl, shippedAt, deliveredAt
- [ ] **FulfillmentItem** — fulfillmentId, orderItemId, quantity
- [ ] **OrderEvent** — orderId, type, title, detail, actorType, actorId, createdAt (powers the order timeline)
- [ ] **Refund** — orderId, paymentId, amount, reason, note, createdAt
- [ ] **Return** — orderId, status, reason, receivedAt, createdAt, updatedAt
- [ ] **Discount** — code, title, type (`CODE | AUTOMATIC`), method, value, startsAt, endsAt, usageLimit, usageCount, status
- [ ] Run `npx prisma migrate dev --name init` and `npx prisma generate`
- [ ] Write seed script: one store, one admin user, 10 sample products, 5 sample orders with events

### 1.3 — Prisma Client + Services Layer (Est: 1 day)

- [ ] Create `lib/prisma.ts` — singleton client (prevents connection pool exhaustion in Next.js dev)
- [ ] Create `server/services/product.service.ts` — getProducts, getProduct, createProduct, updateProduct, deleteProduct
- [ ] Create `server/services/order.service.ts` — getOrders, getOrder, createOrder, updateOrderStatus, createOrderEvent
- [ ] Create `server/services/customer.service.ts` — getCustomers, getCustomer, createCustomer, updateCustomer
- [ ] Create `server/services/auth.service.ts` — createSession, validateSession, revokeSession

---

## Phase 2 — Backend API

### 2.1 — Authentication API + Middleware (Est: 2 days)

Real auth backed by the database. JWT tokens, secure cookies, middleware that blocks unauthenticated access to all admin routes.

- [ ] `POST /api/auth/login` — validate email+password with bcrypt, issue JWT in httpOnly cookie
- [ ] `POST /api/auth/logout` — clear cookie, revoke session in DB
- [ ] `GET /api/auth/me` — return current user from JWT
- [ ] Create `middleware.ts` at root — protect all `/api/*` and admin page routes, allow `/api/auth/*` and `/login` to pass through
- [ ] Create `lib/auth.ts` helper — `verifyToken()`, `getSessionUser()`, `requireRole()`
- [ ] Add rate limiting to login: 5 attempts / 15 minutes per IP (use `@upstash/ratelimit`)

### 2.2 — Products API (Est: 2 days)

- [ ] `GET /api/products` — list with pagination, status filter, search, sort
- [ ] `POST /api/products` — create product with variants, validate with Zod
- [ ] `GET /api/products/[id]` — single product with variants and media
- [ ] `PATCH /api/products/[id]` — update product fields
- [ ] `DELETE /api/products/[id]` — soft delete (set status to ARCHIVED)
- [ ] `PATCH /api/products/[id]/variants/[variantId]` — update inventory, price, SKU
- [ ] `GET /api/storefront/products` — public endpoint, returns ACTIVE products only (no auth required)
- [ ] `GET /api/storefront/products/[handle]` — public single product by URL handle

### 2.3 — Orders, Customers, Discounts, Analytics APIs (Est: 3 days)

- [ ] `GET /api/orders` — list with filters (status, payment, fulfillment, date range), pagination
- [ ] `GET /api/orders/[orderNumber]` — single order with events, items, addresses, payments, fulfillments
- [ ] `PATCH /api/orders/[orderNumber]/status` — update payment/fulfillment status, write OrderEvent
- [ ] `POST /api/orders/[orderNumber]/fulfillments` — create fulfillment record, add tracking number
- [ ] `GET /api/customers` — list with search, sort, pagination
- [ ] `GET /api/customers/[id]` — customer profile with order history
- [ ] `POST /api/customers` + `PATCH /api/customers/[id]` — create and update customer records
- [ ] `GET /api/discounts` + `POST /api/discounts` + `PATCH /api/discounts/[id]`
- [ ] `POST /api/discounts/validate` — public endpoint for storefront discount code validation
- [ ] `GET /api/analytics` — real aggregate stats from DB (revenue, order count, AOV, top products)
- [ ] `GET /api/settings` + `PATCH /api/settings` — read/write Store record

---

## Phase 3 — Connect Admin to Real Data

> Key decision: replace React Context with SWR for server state. Context is fine for UI state (modals, selected rows) but all database data should use SWR — it handles caching, revalidation, and optimistic updates automatically.

- [ ] Create `lib/fetcher.ts` — shared fetch wrapper with auth headers and error handling
- [ ] Wire **Products** module — reads `/api/products`, writes on save, invalidates on mutation
- [ ] Wire **Orders** module — reads `/api/orders`, real order detail by orderNumber from URL param
- [ ] Wire **Customers** module — reads `/api/customers`
- [ ] Wire **Discounts** module — reads `/api/discounts`
- [ ] Wire **Analytics** module — reads `/api/analytics` (real computed DB stats)
- [ ] Wire **Settings** module — reads `/api/settings`, save persists to DB Store record
- [ ] Remove all in-memory data files (`lib/ordersData.js`, `lib/customersData.js`, etc.) once replaced

---

## Phase 4 — Media & Storage

> The product media manager UI is complete but uploads go nowhere. This phase connects it to real cloud storage.

- [ ] Choose storage provider — **Cloudinary** recommended for launch (free tier, built-in image transforms, fast setup). Migrate to S3 later if needed.
- [ ] Install: `npm install cloudinary`
- [ ] `POST /api/media/upload` — accepts `multipart/form-data`, uploads to Cloudinary, returns URL, saves MediaAsset to DB
- [ ] `DELETE /api/media/[id]` — delete from cloud storage + remove DB record
- [ ] Wire `ProductMediaManager` component to real upload endpoint
- [ ] Add drag-to-reorder with position persistence in DB
- [ ] Add store logo upload to Settings → Branding section

---

## Phase 5 — Mockup Storefront

> Architecture: use Next.js Route Groups — `app/(admin)/` and `app/(store)/` in the same app. Both share the same API routes and Prisma backend. Admin writes a product, storefront reads it immediately. No separate deployment.

### Data Flow

```
Admin UI → API Routes ↕ PostgreSQL / Prisma ↕ API Routes → Storefront
```

### Storefront Pages

| Route | Type | Notes |
|-------|------|-------|
| `/` | SSR | Homepage: hero, featured products, featured collections |
| `/products` | SSR | All active products grid, filter, sort |
| `/products/[handle]` | SSR | Gallery, variant picker, add to cart, inventory status |
| `/collections/[handle]` | SSR | Filtered product list |
| `/cart` | Client | Editable cart, discount code field, order summary |
| `/checkout` | Client | Shipping form + Stripe Payment Element |
| `/checkout/success` | SSR | Order confirmation with order number |

### Tasks

- [ ] Create route group `app/(store)/` with its own layout (storefront header, cart icon, store branding from DB)
- [ ] Homepage — hero, featured products grid, featured collections (all DB-driven)
- [ ] Product listing `/products` — grid, filter by collection, sort by price/name/date
- [ ] Product detail `/products/[handle]` — gallery, variant selector, price, add to cart, description
- [ ] Collection page `/collections/[handle]`
- [ ] Use Next.js Server Components for all product reads — no extra API round-trip for SSR
- [ ] Store branding colors from DB Settings injected into storefront CSS variables at layout level

### Cart (Client-Side State)

- [ ] Cart lives in localStorage / React Context until checkout — no DB needed for cart
- [ ] Cart stores: variantId, quantity, title, price, image snapshot
- [ ] Slide-out cart drawer on all storefront pages
- [ ] Cart page `/cart` — editable quantities, remove items, discount code field, order summary
- [ ] Re-validate inventory on cart page load (call `/api/storefront/products/[handle]`)

---

## Phase 6 — Checkout & Stripe

> Always write orders via Stripe webhook, not on client redirect. The webhook is the ground truth — the client browser can close or fail between payment and redirect.

- [ ] Install: `npm install stripe @stripe/stripe-js @stripe/react-stripe-js`
- [ ] Checkout page `/checkout` — shipping address form, order summary, Stripe Payment Element
- [ ] `POST /api/checkout/create` — validate cart items (price + inventory), apply discount code, create Stripe PaymentIntent, return clientSecret
- [ ] `POST /api/webhooks/stripe` — listen for `payment_intent.succeeded`:
  - Create Order + OrderItems + OrderAddresses + Payment records
  - Atomically decrement inventory (see Security section)
  - Write OrderEvent ("Order placed")
  - Trigger order confirmation email
  - Admin Orders page immediately reflects the new order
- [ ] Order success page `/checkout/success?order=[orderNumber]`
- [ ] Verify Stripe webhook signatures on every event — reject unsigned requests with 400
- [ ] Handle `payment_intent.payment_failed` — surface error to customer

---

## Phase 7 — Post-Purchase & Notifications

### 7.1 — Transactional Email (Est: 2 days)

- [ ] Install: `npm install resend react-email`
- [ ] Order confirmation email — triggered on Stripe webhook success, includes order number, line items, shipping address, total
- [ ] Fulfillment / shipping email — triggered when admin adds tracking number to a fulfillment
- [ ] Build email templates with React Email — uses store branding colors from DB Settings

### 7.2 — Customer Account Portal (Est: 2 days)

- [ ] Customer login — separate from admin login, `Customer` table with passwordHash or magic link
- [ ] `/account/orders` — list of past orders tied to authenticated customer email
- [ ] `/account/orders/[orderNumber]` — order detail with fulfillment tracking
- [ ] Address book — save/manage shipping addresses for faster checkout

---

## Phase 8 — Launch Hardening

- [ ] Add `<meta>` tags, Open Graph, canonical URLs on all storefront pages
- [ ] Generate `sitemap.xml` dynamically from published products and collections
- [ ] Add Next.js `<Image>` component on all product images — auto WebP, lazy loading, blur placeholder
- [ ] Add Prisma query indexes: `product.handle`, `order.orderNumber`, `customer.email`, `variant.sku`
- [ ] Configure production environment variables on Vercel
- [ ] Enable Next.js caching on storefront product pages (`revalidate: 60`)
- [ ] Test on mobile — min 44px touch targets, no horizontal scroll, responsive at 375px / 768px / 1024px
- [ ] Run Lighthouse audit — target 90+ on Performance, Accessibility, SEO for storefront
- [ ] Set up error monitoring — **Sentry** (free tier, captures runtime exceptions with stack traces)

---

## Required Integrations

| Service | Priority | Purpose | Install |
|---------|----------|---------|---------|
| **Stripe** | Critical | Payments, PaymentIntents, refunds, webhooks | `npm install stripe @stripe/stripe-js @stripe/react-stripe-js` |
| **Neon / Supabase** | Critical | Managed PostgreSQL — connect via `DATABASE_URL` in Prisma | Provision online → paste connection string |
| **Cloudinary** | High | Image hosting, upload, WebP transforms. 25GB free tier | `npm install cloudinary` |
| **Resend** | High | Transactional email with React Email template support. 3,000/month free | `npm install resend react-email` |
| **Vercel** | High | Zero-config Next.js deployment, edge middleware, preview deployments | `npx vercel` |
| **Zod** | High | Runtime schema validation for all API inputs | `npm install zod` |
| **@upstash/ratelimit** | High | Stateless rate limiting on auth endpoints (works on Vercel Edge) | `npm install @upstash/ratelimit @upstash/redis` |
| **Shippo / EasyPost** | Medium | Real-time shipping rates at checkout, printable labels from admin | `npm install shippo` |
| **Sentry** | Medium | Runtime error monitoring and alerting in production | `npm install @sentry/nextjs` |
| **PostHog / Plausible** | Optional | Privacy-first storefront analytics, no cookie banner needed | Script tag in storefront layout |

---

## Security Requirements

> Current security posture: zero. Any admin URL is publicly accessible. Every item below must be addressed before handling real customer or payment data.

### Admin Route Protection
All admin routes must require a valid session. Unauthenticated requests redirect to `/login`. Implement in `middleware.ts` at the Next.js root — runs on Edge before any page renders.

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/storefront', '/api/webhooks']

export function middleware(req: NextRequest) {
  const isPublic = PUBLIC_PATHS.some(p => req.nextUrl.pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  const token = req.cookies.get('token')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  // verify JWT here
}
```

### Password Hashing
Never store plaintext passwords. Hash with bcrypt cost factor 12. Compare hashes on login — never compare raw strings.
```ts
import bcrypt from 'bcryptjs'
const hash = await bcrypt.hash(password, 12)
const valid = await bcrypt.compare(password, hash)
```

### JWT in httpOnly Cookie
Store the JWT in an `httpOnly; Secure; SameSite=Strict` cookie — not localStorage. httpOnly prevents JavaScript from reading it, blocking XSS token theft entirely.
```ts
res.setHeader('Set-Cookie', `token=${jwt}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`)
```

### Rate Limiting on Auth
Limit login to 5 attempts / 15 minutes per IP using `@upstash/ratelimit`. This prevents brute-force attacks on admin credentials.

### Input Validation (Zod)
Validate and parse every API request body before it touches Prisma. Reject unknown fields, enforce types, validate string lengths. Return structured 400 errors — never expose internal errors or Prisma exceptions.
```ts
const schema = z.object({ email: z.string().email(), password: z.string().min(8) })
const result = schema.safeParse(body)
if (!result.success) return Response.json({ success: false, error: 'Invalid input' }, { status: 400 })
```

### Stripe Webhook Signatures
Verify every incoming Stripe webhook with the signing secret. Unsigned events must be rejected with 400. Prevents anyone from forging order creation events.
```ts
const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
```

### CORS Configuration
Lock API routes to your own domain in `next.config`. Public storefront routes accept requests from the storefront origin. Admin routes should never be callable from external origins.

### Security Headers
Add these to `next.config` headers():
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — restrict script/style sources

### SQL Injection Prevention
Prisma's parameterized queries prevent SQL injection by default. Never use `prisma.$queryRaw` with string interpolation — use tagged templates only.

### Inventory Race Conditions
When two people buy the last item simultaneously, both can pass the inventory check. Use Prisma's atomic decrement with a conditional `where` to prevent overselling:
```ts
const updated = await prisma.productVariant.updateMany({
  where: { id: variantId, inventory: { gt: 0 } },
  data: { inventory: { decrement: quantity } }
})
if (updated.count === 0) throw new Error('Out of stock')
```

### Role-Based Access
Admin users have roles: `OWNER`, `STAFF`, `VIEWER`. Enforce in API middleware — never rely on hiding buttons in the UI.

| Role | Permissions |
|------|------------|
| OWNER | Full access — delete products, manage users, view all reports |
| STAFF | Manage orders, products, customers, discounts |
| VIEWER | Read-only access across all admin modules |

### Environment Variables
Never commit `.env.local`. Rotate secrets if ever exposed in git history. Use Vercel's encrypted environment variable storage. Only prefix public vars with `NEXT_PUBLIC_` — treat everything else as server-only.

---

## Suggested Features to Add

These are not launch blockers but will significantly improve the product post-launch.

| Feature | Value | Notes |
|---------|-------|-------|
| **Collections / Smart Filters** | High | Admin creates collections with manual or automated rules. Storefront renders collection pages. |
| **Abandoned Cart Recovery** | High | Email customers who start checkout but don't complete — 1hr and 24hr follow-ups via Resend |
| **Storefront Full-Text Search** | High | PostgreSQL full-text search via Prisma. Optional: Algolia for faceted search at scale. |
| **Product Reviews** | Medium | Star rating + text tied to verified purchases. Moderation queue in admin. |
| **Inventory Alerts** | Medium | Email admin when variant inventory drops below a configured threshold |
| **Tax Calculation** | Medium | Integrate Stripe Tax or TaxJar to auto-calculate sales tax by shipping address |
| **Gift Cards** | Medium | Issue gift card codes redeemable at checkout. Track balance in DB. |
| **Real-Time Inventory** | Low | Show "Only 3 left" live on product pages via SWR polling |
| **Admin Activity Log** | Low | Audit table for every admin action — who changed what and when |
| **Bulk Operations** | Low | Bulk price update, status change, tag assignment on selected products |
| **CSV Import / Export** | Low | Import products from CSV, export orders/customers for accounting |
| **Outbound Webhooks** | Low | Let store owners configure webhook endpoints for order events — foundation for a plugin system |

---

## Suggested Timeline

| Week | Milestone |
|------|-----------|
| 1–2 | PostgreSQL provisioned, full Prisma schema with all 20 models, migrations run, seed data, TypeScript migration |
| 3–4 | Auth endpoint live, middleware protecting admin routes, all CRUD APIs for products/orders/customers/discounts/media |
| 5–6 | Every admin module wired to real API. Products persist. Orders persist. Analytics pulls from DB. In-memory data files deleted. |
| 7–8 | Public storefront live — homepage, product listing, product detail, cart, collections. Catalog flow works end-to-end. |
| 9–10 | Stripe integrated, real payments processed, orders created via webhook, inventory decremented, confirmation email sent |
| 11–12 | End-to-end testing, security audit, Lighthouse 90+ on storefront, mobile testing, SEO meta tags, production config |
| 13–14 | Custom domain, SSL, production Stripe keys, final smoke tests, monitoring. Ship. |

---

## Fastest Path to First Real Data Flow

Complete in this order for the quickest win:

1. Provision PostgreSQL (Neon — 2 minutes)
2. Write Prisma schema for `Product` + `ProductVariant` only
3. Run `prisma migrate dev` + seed 5 products
4. Build `GET /api/products` (10 lines with Prisma)
5. Wire the Products admin page to that endpoint with SWR

That's 3–4 days of focused work and you'll have your first real end-to-end data flow. Every other module follows the exact same pattern.

---

## Definition of Done

A feature is complete when:
- It works end-to-end: DB → API → UI
- It handles errors properly and returns structured `{ success, data, error }` responses
- It is reusable and maintainable — controllers are thin, logic lives in services
- It follows the defined architecture — all DB access goes through Prisma, never bypassed
- It validates all inputs with Zod before touching any service

---

## API Response Standard

All API routes return this shape:

```ts
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }

// Paginated list
{ success: true, data: T[], pagination: { page, pageSize, total, totalPages } }
```

---

*Doopify Commerce OS — Roadmap v1.0 — April 2026*
