# Doopify Hardening Checklist

> Last updated: April 21, 2026
> Companion to `features-roadmap.md`. This file is a pre-Phase-1 hardening pass — code-quality and security fixes that should land **before** the Stripe checkout build so the revenue path sits on a trustworthy foundation.

These items came out of a line-level audit of `src/server/services/*`, `src/proxy.ts`, `src/lib/auth.ts`, `src/app/api/**`, and `src/components/ui/`. Each item lists the file, the issue, and the fix.

---

## Priority 0 — Do First (this week)

### 1. Verify middleware is actually running

- **File:** `src/proxy.ts`
- **Issue:** Next.js App Router expects `src/middleware.ts` exporting a function named `middleware`. This file is named `proxy.ts` and exports `proxy()`. If there is no re-export or custom wiring, the admin route guard is **not executing** and every `/admin/*` page plus private API is currently unauthenticated.
- **Fix:** Either rename to `src/middleware.ts` and export `middleware`, or add a `src/middleware.ts` that re-exports: `export { proxy as middleware, config } from './proxy'`. Confirm with a curl against `/api/products` without a cookie — it must return 401.

### 2. Block or sanitize SVG uploads

- **File:** `src/app/api/media/upload/route.ts` (line ~15)
- **Issue:** MIME is taken straight from client-supplied `file.type` with no magic-byte validation. `image/svg+xml` is in `ALLOWED_TYPES`. SVGs can embed `<script>` — when served back inline in the admin, that is stored XSS.
- **Fix:**
  - Drop `image/svg+xml` from `ALLOWED_TYPES`, **or**
  - Install `file-type` and validate the magic bytes match the claimed MIME, **and**
  - If SVG support is required, run DOMPurify with `USE_PROFILES: { svg: true }` on upload.
- **Also on this route:** `productId` from form data is passed to `productMedia.create` with no ownership check. Validate the product exists before linking.

### 3. Make JWT revocation real

- **File:** `src/lib/auth.ts` (`verifyToken`, ~line 26), `src/server/services/auth.service.ts` (`logoutUser`, ~line 75)
- **Issue:** `verifyToken` never looks up `prisma.session`. A stolen or logged-out token stays valid for its full 7-day JWT expiry because `logoutUser` only deletes the DB row — and even that delete is silent-failed via `.catch(() => null)`.
- **Fix:**
  - Inside `verifyToken`, after JWT signature check, look up `prisma.session.findUnique({ where: { token } })`. If missing or expired, throw.
  - Remove the `.catch(() => null)` from `logoutUser`. Log failures and return a non-OK to the caller.

### 4. Add login rate limiting

- **File:** `src/app/api/auth/login/route.ts`
- **Issue:** No rate limiter anywhere in the codebase. Brute force is open.
- **Fix:** Add `@upstash/ratelimit` (or `rate-limiter-flexible` if staying local) keyed on IP + email. 5 attempts / 15 minutes is a reasonable baseline.

### 5. Tighten `PUBLIC_PREFIXES` matching

- **File:** `src/proxy.ts` (lines 6–15)
- **Issue:** Uses `startsWith`, so `/api/auth-bypass`, `/api/storefront-admin`, `/api/webhooks-debug`, etc. all match as public prefixes.
- **Fix:** Match on segment boundaries: `pathname === prefix || pathname.startsWith(prefix + '/')`.

### 6. Fix the cookie regex

- **File:** `src/lib/api.ts` (`getToken`, lines 23–27)
- **Issue:** Regex `/doopify_token=([^;]+)/` is unanchored; `xdoopify_token=attackertoken` would match.
- **Fix:** Use `(?:^|;\s*)doopify_token=([^;]+)`, or better, consolidate with `src/server/services/auth.service.ts:100` (`getTokenFromCookieHeader`) into a single helper in `src/lib/cookies.ts` that uses proper cookie parsing.

---

## Priority 1 — Do Before Stripe Checkout

### 7. Add a storefront DTO layer

- **Files:** `src/app/api/storefront/products/route.ts`, `src/app/api/storefront/products/[handle]/route.ts`
- **Issue:** Routes return the raw Prisma object. Variants expose `inventory` (and would expose `cost`/`sku` when added). Top-level `tags`, `vendor`, `productType` are admin-facing but served publicly.
- **Fix:** Add `toStorefrontProduct()` and `toStorefrontVariant()` in `src/server/services/product.service.ts`. Whitelist fields explicitly. Have every storefront route call only these.

### 8. Recompute order totals server-side

- **File:** `src/server/services/order.service.ts` (line ~132)
- **Issue:** `total` is accepted from the caller as-is; no server-side recompute against `subtotal + taxAmount + shippingAmount - discountAmount`. When the Stripe webhook becomes the order creator, trusting the client here becomes a price-tampering vector.
- **Fix:** Ignore caller-supplied `total` entirely. Recompute inside the transaction. Also: line 126 hardcodes `paymentStatus: 'PAID'` — parameterize it now before webhook-created orders add a second code path.

### 9. Normalize customer email

- **File:** `src/server/services/customer.service.ts` (lines ~75, ~91)
- **Issue:** Email is written as-typed. `Jane@X.com` and `jane@x.com` create two customers; checkout-time `getCustomerByEmail` misses duplicates. Tags are also assigned raw with no dedupe / trim.
- **Fix:**
  - Add `email = email.toLowerCase().trim()` at the service boundary for both writes and reads.
  - Add `tags = Array.from(new Set(tags.map(t => t.trim()).filter(Boolean)))`.

### 10. Extract remaining services

- **Files:** `src/app/api/discounts/*`, `src/app/api/media/*`, `src/app/api/settings/*`, `src/app/api/analytics/*`
- **Issue:** These routes have business logic living in the route handler. The `auth`, `customer`, `product`, `order` services have already been extracted — these four haven't.
- **Fix:** Create `discount.service.ts`, `media.service.ts`, `settings.service.ts`, `analytics.service.ts`. Keep route handlers thin.

### 11. Build the shared UI primitive set

- **Folder:** `src/components/ui/`
- **Issue:** Only contains `etheral-shadow.tsx` and `demo.tsx`. Every admin page re-rolls its own form controls, buttons, tables, and modals. The Linear/Vercel visual refresh described in the audit doc will be a painful multi-page rewrite unless the primitives exist first.
- **Fix:** Build the minimum viable set before Stripe checkout UI lands: `Button`, `Input`, `Label`, `Select`, `Checkbox`, `Card`, `Table`, `Badge`, `Modal`, `Tabs`, `Toast`. Either hand-rolled with CSS variables, or imported from shadcn/ui.

### 12. Fix split-transaction product creation

- **File:** `src/server/services/product.service.ts` (around the create + upsertOptions pair)
- **Issue:** `createProduct` and `upsertOptions` are two separate transactions. If the second fails, the product exists in the DB with no options — an orphan the admin UI doesn't recover from.
- **Fix:** Wrap both in a single `prisma.$transaction`, or move option creation into `createProduct` itself.

### 13. Fix `slugify` empty-string failure

- **File:** `src/server/services/product.service.ts` (~line 489)
- **Issue:** Titles like `"!!!"` or emoji-only titles produce empty handles, which then throw opaque 500s on the unique constraint.
- **Fix:** `const handle = slugify(title) || cuid().slice(0, 8)` plus a uniqueness check-and-suffix helper.

### 14. Fix `orderNumber` search coercion

- **File:** `src/server/services/order.service.ts` (~line 24)
- **Issue:** `Number(' ')` is `0` and `isNaN(Number(''))` is `false`. Empty search strings silently filter `orderNumber` to 0.
- **Fix:** `const n = Number(query); if (!Number.isFinite(n) || n <= 0) { /* skip orderNumber branch */ }`

### 15. Customer derived fields drift

- **File:** `src/server/services/customer.service.ts`
- **Issue:** `totalSpent` and `orderCount` are only incremented inside `createOrder`. Never decremented on refunds, returns, or cancellations. Will silently diverge from truth.
- **Fix:** Either (a) hook decrements into refund/cancel service paths, or (b) recompute on read with `prisma.order.aggregate({ where: { customerId } })`. Option (b) is simpler and has acceptable cost with the existing `@@index([customerId])` on `orders`.

---

## Priority 2 — Do Alongside Phase 1

### 16. Split cookie strategy for storefront vs admin

- **File:** `src/lib/auth.ts` (~line 61)
- **Issue:** `sameSite: 'strict'` works today. It will break when Stripe redirects a customer back from 3DS or hosted checkout — the cookie won't be sent on the cross-origin return navigation.
- **Fix:** Keep `strict` for the admin `doopify_token`. When customer auth is built, use a separate `doopify_customer` cookie with `sameSite: 'lax'`.

### 17. Centralize env validation

- **File:** create `src/lib/env.ts`
- **Issue:** Every `process.env.X` is ad-hoc. `JWT_SECRET` throws at runtime when first used — too late.
- **Fix:** One Zod schema, parsed once at boot, exported as a typed `env` object. Fail fast on missing required vars.

```ts
// src/lib/env.ts
import { z } from 'zod'
const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
})
export const env = schema.parse(process.env)
```

### 18. Install Phase 1 dependencies

- **File:** `package.json`
- **Missing:**
  - `stripe` (server SDK)
  - `@stripe/stripe-js`, `@stripe/react-stripe-js` (client Elements)
  - `resend` + `@react-email/components` (Phase 3 email)
  - `@upstash/ratelimit` or equivalent
  - `file-type` (magic-byte MIME sniffing)
  - `@types/pg` (you have `pg@^8.20.0` as a direct dep without types)

### 19. Add tests

- **Folder:** `src/__tests__/` (none exist today)
- **Issue:** No `*.test.ts`, no `vitest.config`, no coverage. The things most likely to break silently in production — inventory-decrement race, totals math, auth edge cases — have zero automated checks.
- **Fix:** Install Vitest. One test file per service, 3–5 table-driven cases each. Add scripts:

```json
"test": "vitest",
"test:ci": "vitest run",
"typecheck": "tsc --noEmit"
```

---

## Priority 3 — Nice to Have

### 20. Return already-included records from mutations

- **File:** `src/server/services/product.service.ts` (~lines 273–307, 328–346)
- **Issue:** Create/update do a `findUnique` re-fetch after the transaction instead of returning the already-modified record with `include`.
- **Fix:** Return from inside the transaction with the include attached.

### 21. Project admin list fields

- **File:** `src/server/services/order.service.ts` (lines ~30–42)
- **Issue:** Admin order list includes full `customer, items, addresses, payments` for every row — heavy payload at scale.
- **Fix:** Add a `select` projection for the list view; keep the full include only for the detail view.

### 22. Storefront product include leaks variant fields

- **File:** `src/server/services/product.service.ts` (~lines 16–19)
- **Issue:** Hardcodes `take: 2` media but no `select` on variants — returns every variant field.
- **Fix:** Use `toStorefrontVariant()` from item 7.

### 23. Use 422 for validation failures

- **File:** `src/lib/api.ts` (the `err` helper)
- **Issue:** All validation and body-parse failures return 400. Semantic status codes help clients differentiate.
- **Fix:** Add an `unprocessable()` helper that returns 422, use it for Zod failures.

### 24. Surface all Zod errors, not just the first

- **File:** `src/app/api/products/route.ts` (~line 83) and others following the same pattern
- **Issue:** `parsed.error.errors[0].message` drops the rest of the validation errors.
- **Fix:** Return the full `parsed.error.flatten()` so the form can highlight every invalid field.

### 25. Move media off Postgres eventually

- **Issue:** `MediaAsset.data` stores binary in Postgres. Works for now, bloats backups and scales poorly past a few thousand assets.
- **Fix (later):** Migrate to S3/R2/Cloudinary with the existing `MediaAsset` row keeping a URL instead of bytes. Not urgent — track as a Phase 4 launch-hardening item.

### 26. Add scripts that don't exist yet

- **File:** `package.json`
- **Missing scripts:** `test`, `test:ci`, `typecheck`, `format`, `format:check`. No Prettier config either.

---

## Scope Summary

| Bucket | Count | When |
|--------|-------|------|
| Priority 0 — this week | 6 | Before any Phase 1 work |
| Priority 1 — hardening sprint | 9 | ~1 week before Stripe checkout |
| Priority 2 — alongside Phase 1 | 4 | During Stripe checkout build |
| Priority 3 — nice to have | 7 | Opportunistic |

Six items (P0) are the must-do gate: middleware wiring, SVG XSS, JWT revocation, rate limit, prefix matching, cookie regex. Nothing in Phase 1 should start until those land — they're foundational trust issues and they're all small.

## Tracking

When an item lands, update this file with the PR/commit SHA. When a priority tier is fully closed, strike it through and move to the next.
