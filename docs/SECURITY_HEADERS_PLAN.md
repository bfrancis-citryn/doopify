# Production Security Headers Plan

Documentation date: May 1, 2026

## Goal
Plan CSP and response-header hardening for Doopify without breaking Next.js, Stripe checkout, provider webhooks, images, admin pages, or local development.

This is a planning document only. No runtime headers are implemented in this change.

## Current State Inspected

### `src/proxy.ts`

Current proxy behavior is focused on route protection, not response hardening.

Observed behavior:

- `PUBLIC_PREFIXES` bypass auth for public routes and operational webhook/runner endpoints:
  - `/login`
  - `/api/auth`
  - `/api/checkout`
  - `/api/storefront`
  - `/api/webhooks`
  - `/api/webhook-retries`
  - `/api/abandoned-checkouts/send-due`
  - `/api/jobs/run`
  - `/_next`
  - `/favicon`
  - `/images`
  - `/public`
- Non-admin public storefront pages pass through.
- Admin pages and private API routes require `doopify_token`.
- Valid sessions add request headers:
  - `x-user-id`
  - `x-user-role`
  - `x-user-email`
- Invalid/missing auth returns API JSON errors or redirects admin pages to `/login`.
- No security response headers are currently set in `src/proxy.ts`.

Important implementation constraint:

- Do not disrupt auth gating or public-prefix behavior when headers are added.
- If security headers are added in proxy later, they must be applied to every `NextResponse.next()`, redirect, and JSON response path consistently.

### `next.config.mjs`

Current global headers already exist through `nextConfig.headers()`:

```txt
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

This means the first implementation should either:

1. keep static global headers in `next.config.mjs` and add only CSP/HSTS/Permissions-Policy there, or
2. move all response security headers into one shared helper used by `src/proxy.ts`.

Avoid maintaining conflicting header definitions in both places.

## Recommended Implementation Strategy

### Preferred approach

Add a shared security-header builder and use it from `src/proxy.ts`.

Suggested file:

```txt
src/server/security/security-headers.ts
```

Why:

- It can vary behavior by environment.
- It can add a CSP nonce later if needed.
- It can apply to redirects and auth failures, not just normal page responses.
- It keeps all header decisions in one testable module.

Then either:

- remove duplicate static security headers from `next.config.mjs`, or
- leave only truly static headers there and document that dynamic headers live in proxy.

Recommended cleanup once proxy implementation is complete:

```txt
next.config.mjs should not duplicate headers managed by security-headers.ts.
```

### Staged rollout

1. Add report-only CSP in production first.
2. Monitor console/report violations in real admin/storefront/checkout flows.
3. Move to enforced CSP after known origins and inline-style requirements are handled.
4. Add stricter policies incrementally.

## Proposed Headers

### 1. Content-Security-Policy

Initial production report-only policy:

```txt
Content-Security-Policy-Report-Only:
  default-src 'self';
  base-uri 'self';
  object-src 'none';
  frame-ancestors 'none';
  form-action 'self';
  script-src 'self' 'unsafe-inline' https://js.stripe.com;
  script-src-elem 'self' 'unsafe-inline' https://js.stripe.com;
  style-src 'self' 'unsafe-inline';
  style-src-elem 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' https://api.stripe.com https://*.stripe.com;
  frame-src https://js.stripe.com https://hooks.stripe.com;
  worker-src 'self' blob:;
  manifest-src 'self';
  upgrade-insecure-requests;
```

Why report-only first:

- Checkout currently loads Stripe.js dynamically from `https://js.stripe.com/v3/`.
- Checkout and storefront components contain inline styles and style blocks.
- Next.js may need dev-only script/eval allowances.
- Object-storage/CDN media origins are not finalized yet.

Later enforced production policy should remove broad allowances where possible:

- remove `'unsafe-inline'` from scripts after moving dynamic inline code to safe patterns or nonce/hash support
- restrict `img-src https:` to explicit media CDN origins once object storage/CDN origins are chosen
- add `report-uri` or `report-to` only after a reporting endpoint exists

### 2. Strict-Transport-Security

Production only:

```txt
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Later, after HTTPS is stable on all subdomains:

```txt
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

Do not send HSTS in local development.

### 3. Referrer-Policy

Current value is good:

```txt
Referrer-Policy: strict-origin-when-cross-origin
```

Keep this unless checkout/provider flows require a different policy.

### 4. X-Content-Type-Options

Current value is good:

```txt
X-Content-Type-Options: nosniff
```

Keep globally, including media responses.

### 5. Frame protection / `frame-ancestors`

Current `X-Frame-Options: DENY` exists.

Recommended future direction:

- Keep `X-Frame-Options: DENY` for legacy browser defense.
- Add CSP `frame-ancestors 'none'` for modern browsers.

Important distinction:

- `frame-ancestors` controls who can embed Doopify.
- `frame-src` controls what Doopify can embed.

Stripe Elements needs `frame-src` allowances, but that does not require allowing Doopify itself to be framed by third parties.

### 6. Permissions-Policy

Initial recommendation:

```txt
Permissions-Policy:
  camera=(),
  microphone=(),
  geolocation=(),
  payment=(self),
  usb=(),
  serial=(),
  bluetooth=(),
  accelerometer=(),
  gyroscope=(),
  magnetometer=(),
  fullscreen=(self)
```

Notes:

- Keep `payment=(self)` initially to avoid blocking payment-related browser APIs if checkout expands.
- Do not block clipboard until admin workflows are checked; admins may need copy/paste for IDs, webhooks, or secrets.

## Required External Origins

### Stripe

Current checkout dynamically loads Stripe.js from:

```txt
https://js.stripe.com/v3/
```

Required CSP origins:

```txt
script-src/script-src-elem: https://js.stripe.com
frame-src: https://js.stripe.com https://hooks.stripe.com
connect-src: https://api.stripe.com https://*.stripe.com
```

Keep this broad enough during report-only rollout because Stripe Elements may call Stripe subdomains internally.

### Fonts

Current source inspection did not show external font imports in the checked files, but the plan should allow future Google Fonts only if actually used.

Potential origins:

```txt
style-src/style-src-elem: https://fonts.googleapis.com
font-src: https://fonts.gstatic.com
```

Recommendation:

- Do not add Google font origins unless the app actually imports Google Fonts.
- Prefer self-hosted fonts for stricter CSP later.

### Images and media

Current media is served through app-owned URLs:

```txt
/api/media/{assetId}
```

Current safe baseline:

```txt
img-src 'self' data: blob:
```

During media object-storage migration, add explicit production media origins, for example:

```txt
img-src 'self' data: blob: https://media.example.com https://*.r2.dev https://*.cloudflarestorage.com https://*.amazonaws.com
```

Recommendation:

- Start with `img-src 'self' data: blob: https:` in report-only mode.
- Tighten to exact CDN/object-storage domains after `MEDIA_OBJECT_STORAGE_PLAN.md` is implemented.

### Analytics

Doopify currently has server-side durable `AnalyticsEvent` persistence. No client analytics vendor was confirmed in this inspection.

Baseline:

```txt
connect-src 'self'
script-src 'self'
```

If a vendor is later added, list it explicitly in the CSP plan before implementation. Do not use wildcard analytics domains by default.

### Email/provider webhooks

Inbound provider webhooks are server-to-server requests:

```txt
POST /api/webhooks/stripe
POST /api/webhooks/email-provider
POST /api/webhooks/shipping-provider?provider=EASYPOST|SHIPPO
POST /api/webhook-retries/run
POST /api/jobs/run
POST /api/abandoned-checkouts/send-due
```

CSP does not block inbound server-to-server webhook requests. However:

- security headers should still be safe on JSON/webhook responses
- request body parsing and signature verification must remain unaffected
- do not add frame/script assumptions to webhook routes
- do not require browser-only headers for webhook callers

### Admin and Next.js runtime

Admin and App Router pages may require:

```txt
script-src 'self'
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob:
connect-src 'self'
```

Development mode may require additional relaxed behavior for Next dev tooling.

## Dev vs Production Behavior

### Development

Recommended dev behavior:

- Keep existing basic headers if they do not break local dev.
- Do not send HSTS.
- Do not enforce CSP.
- Optional: send a very loose `Content-Security-Policy-Report-Only` only when explicitly enabled.
- Allow Next dev runtime needs:
  - `'unsafe-eval'`
  - `'unsafe-inline'`
  - websocket connections for HMR such as `ws:` and `wss:`

Example dev policy if needed:

```txt
Content-Security-Policy-Report-Only:
  default-src 'self' http: https: data: blob: ws: wss:;
  script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:;
  style-src 'self' 'unsafe-inline' http: https:;
  connect-src 'self' http: https: ws: wss:;
```

### Production

Recommended production behavior:

- Send HSTS.
- Send `nosniff`.
- Send `strict-origin-when-cross-origin`.
- Send `X-Frame-Options: DENY` plus CSP `frame-ancestors 'none'`.
- Start CSP as report-only.
- Move to enforced CSP after verifying checkout, admin, media, and provider flows.

Recommended env controls:

```txt
SECURITY_HEADERS_ENABLED=true
CSP_MODE=report-only|enforce|off
CSP_REPORT_URI=https://example.com/api/csp-report optional later
```

## Implementation Notes For Later

### Shared helper shape

Suggested API:

```ts
type SecurityHeaderOptions = {
  environment: 'development' | 'production' | 'test'
  cspMode?: 'off' | 'report-only' | 'enforce'
  mediaOrigins?: string[]
  analyticsOrigins?: string[]
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): HeadersInit
export function applySecurityHeaders(response: NextResponse, options?: Partial<SecurityHeaderOptions>): NextResponse
```

### Proxy integration

Every response path should receive headers:

- public `NextResponse.next()` responses
- protected `NextResponse.next()` responses
- API JSON auth failures
- redirects to login

Do not accidentally skip headers on unauthorized API responses.

### `next.config.mjs` cleanup

Once proxy-based headers exist, remove or reduce the current global `headers()` entries to avoid drift.

If static headers remain in `next.config.mjs`, tests should verify they match the shared constants.

## Test Plan

### Unit tests

Add tests for `buildSecurityHeaders()`:

- production includes HSTS
- development excludes HSTS
- production includes `X-Content-Type-Options: nosniff`
- production includes `Referrer-Policy: strict-origin-when-cross-origin`
- production includes `X-Frame-Options: DENY`
- production includes `Permissions-Policy`
- report-only mode sets `Content-Security-Policy-Report-Only`
- enforce mode sets `Content-Security-Policy`
- off mode sets no CSP header
- Stripe origins are included in script/frame/connect directives
- media origins can be injected without wildcarding everything

### Proxy tests

Add tests for `src/proxy.ts` behavior:

- public storefront page gets security headers
- admin page redirect to login gets security headers
- unauthorized API JSON response gets security headers
- authorized admin/API response gets security headers and still includes existing `x-user-*` headers
- public webhook path remains public and receives safe headers without requiring auth

### Build/manual checks

Manual browser checks before enforcing CSP:

- `/` storefront loads
- `/shop` loads images
- `/shop/[handle]` loads product images
- `/collections` and `/collections/[handle]` load collection/product imagery
- `/checkout` loads Stripe.js and payment element
- `/checkout/success` works after Stripe redirect/polling
- `/admin` loads
- `/admin/settings`, `/admin/webhooks`, `/media`, and order detail pages load
- email/shipping/Stripe webhook endpoints still accept signed requests

## Rollout Recommendation

1. Add `security-headers.ts` helper and tests.
2. Apply basic non-CSP headers through proxy or keep current `next.config.mjs` headers temporarily.
3. Add production-only HSTS.
4. Add production `Content-Security-Policy-Report-Only`.
5. Verify real admin/storefront/checkout flows.
6. Add exact media/CDN origins after object-storage origin is known.
7. Convert CSP from report-only to enforced.
8. Remove duplicate static header definitions from `next.config.mjs` or document why they remain.

## Non-Goals For First Implementation

- Building a CSP report ingestion endpoint.
- Adding per-request CSP nonces.
- Removing all inline styles immediately.
- Enforcing a strict CSP before Stripe/admin/media flows are tested.
- Changing auth behavior in `src/proxy.ts`.
- Blocking inbound provider webhooks with browser-focused assumptions.

## Open Questions

- Will production media use app-proxied `/api/media/{id}` URLs, direct CDN URLs, or signed object-storage URLs?
- Will Doopify use Google Fonts, self-hosted fonts, or merchant-configured external font URLs?
- Will a client-side analytics vendor be added, or will analytics remain server-side only?
- Should the admin ever be embeddable inside another app, or should `frame-ancestors 'none'` remain permanent?
- Should CSP reporting go to an internal endpoint, provider service, or logs-only approach?
