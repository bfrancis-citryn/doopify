# Production Security Headers And CSP Plan

Documentation date: May 1, 2026  
Implementation status updated: May 2, 2026

## Goal

Harden Doopify response headers and Content Security Policy without breaking Next.js, Stripe checkout, provider webhooks, images, admin pages, or local development.

## Implementation Status

Shipped foundation:

- Shared security-header builder in `src/server/security/security-headers.ts`.
- Proxy-applied response headers through `src/proxy.ts`.
- Headers are applied to public pages, protected pages, redirects, and JSON auth failures.
- Production sends HSTS.
- Production CSP defaults to report-only.
- CSP can be explicitly enforced with `CSP_MODE=enforce`.
- CSP can be disabled with `CSP_MODE=off`.
- All security headers can be emergency-disabled with `SECURITY_HEADERS_ENABLED=false`.
- Stripe-safe script/connect/frame origins are included.
- Media CSP can use exact origins from `CSP_MEDIA_ORIGINS` and `MEDIA_PUBLIC_BASE_URL`.
- When exact media origins are configured, the broad `https:` media fallback is not included.
- Development mode remains permissive enough for Next/HMR and does not send HSTS.

Still intentionally pending:

- Production default remains report-only until real storefront/admin/checkout/media flows are monitored.
- No CSP report ingestion endpoint exists yet.
- Inline script/style cleanup and nonce/hash support are not part of this slice.

## Runtime Controls

```txt
SECURITY_HEADERS_ENABLED=false
CSP_MODE=off|report-only|enforce
CSP_MEDIA_ORIGINS=https://media.example.com,https://cdn.example.com
CSP_ANALYTICS_ORIGINS=https://analytics.example.com
MEDIA_PUBLIC_BASE_URL=https://cdn.example.com/media
```

Behavior:

- `CSP_MODE` controls report-only vs enforce.
- `CSP_MEDIA_ORIGINS` is the preferred way to list exact image/media origins.
- `MEDIA_PUBLIC_BASE_URL` is automatically converted to an origin and included in `img-src` when present.
- If no exact media origin is configured, `img-src` includes broad `https:` for report-only compatibility.
- If an exact media origin is configured, `img-src` omits the broad `https:` fallback.

## Current Implemented Headers

Baseline headers:

```txt
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self), usb=(), serial=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=(), fullscreen=(self)
```

Production-only:

```txt
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Production default CSP mode:

```txt
Content-Security-Policy-Report-Only
```

Explicit enforce mode:

```txt
Content-Security-Policy
```

## Implemented CSP Shape

Production CSP currently includes:

```txt
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' 'unsafe-inline' https://js.stripe.com;
script-src-elem 'self' 'unsafe-inline' https://js.stripe.com;
style-src 'self' 'unsafe-inline';
style-src-elem 'self' 'unsafe-inline';
img-src 'self' data: blob: <configured-media-origins-or-https-fallback>;
font-src 'self' data:;
connect-src 'self' https://api.stripe.com https://*.stripe.com <configured-analytics-origins>;
frame-src https://js.stripe.com https://hooks.stripe.com;
worker-src 'self' blob:;
manifest-src 'self';
upgrade-insecure-requests
```

## Required External Origins

### Stripe

Required by checkout:

```txt
script-src/script-src-elem: https://js.stripe.com
connect-src: https://api.stripe.com https://*.stripe.com
frame-src: https://js.stripe.com https://hooks.stripe.com
```

### Media

Default compatibility behavior:

```txt
img-src 'self' data: blob: https:
```

Enforce-ready behavior when object storage/CDN is configured:

```txt
CSP_MEDIA_ORIGINS=https://cdn.example.com
MEDIA_PUBLIC_BASE_URL=https://cdn.example.com/media
```

Then CSP becomes exact-origin based, for example:

```txt
img-src 'self' data: blob: https://cdn.example.com
```

### Analytics

Doopify currently has server-side durable analytics. No client analytics vendor is required by default.

If a client-side vendor is added later, list it explicitly through:

```txt
CSP_ANALYTICS_ORIGINS=https://analytics.example.com
```

### Provider webhooks

Inbound provider webhooks are server-to-server and not blocked by browser CSP:

```txt
POST /api/webhooks/stripe
POST /api/webhooks/email-provider
POST /api/webhooks/shipping-provider?provider=EASYPOST|SHIPPO
POST /api/webhook-retries/run
POST /api/jobs/run
POST /api/abandoned-checkouts/send-due
```

Security headers are safe on these responses and do not replace signature verification.

## Dev vs Production Behavior

### Development

- No HSTS.
- CSP off by default unless explicitly configured.
- Next/HMR allowances include `ws:`, `wss:`, and `'unsafe-eval'` when CSP is enabled in dev.

### Production

- HSTS enabled.
- Baseline hardening headers enabled.
- CSP report-only by default.
- Enforce only after manual production/staging validation.

## Enforcement Checklist

Before setting `CSP_MODE=enforce` in production:

1. Verify `/`, `/shop`, product detail, collections, and collection detail image loading.
2. Verify `/checkout` loads Stripe.js and completes a test checkout.
3. Verify `/checkout/success` works after payment completion.
4. Verify `/admin`, `/settings`, `/admin/webhooks`, `/media`, `/orders/[orderNumber]`, and `/products` load normally.
5. Verify media URLs load with Postgres fallback and with S3/R2 object storage.
6. Configure exact media origins with `CSP_MEDIA_ORIGINS` or `MEDIA_PUBLIC_BASE_URL`.
7. Check browser console/report-only violations for admin UI inline scripts/styles, Stripe frames, media URLs, and any client analytics.
8. Confirm inbound webhooks are unaffected.
9. Run:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
npm run test:integration
```

## Test Coverage

Current fast tests cover:

- baseline header construction
- production HSTS
- dev HSTS exclusion
- production report-only default
- explicit CSP enforce mode
- CSP off mode
- Stripe origin inclusion
- explicit media and analytics origin inclusion
- broad media fallback when no exact origin exists
- `MEDIA_PUBLIC_BASE_URL` inclusion in `img-src`
- `CSP_MEDIA_ORIGINS` inclusion in `img-src`
- exact media origins replacing broad `https:` fallback
- emergency security-header disable
- proxy response paths for public, protected, redirect, auth failure, and webhook routes

## Non-Goals

- Building a CSP report ingestion endpoint.
- Adding per-request CSP nonces.
- Removing all inline styles immediately.
- Enforcing strict CSP by default.
- Changing auth behavior in `src/proxy.ts`.
- Blocking inbound provider webhooks with browser-focused assumptions.

## Remaining Open Questions

- Should CSP violation reports go to an internal endpoint or a third-party monitoring service?
- Should production eventually remove `'unsafe-inline'` through nonce/hash support?
- Should product media eventually use direct CDN URLs in storefront DTOs instead of app-proxied `/api/media/{id}` URLs?
- Should `frame-ancestors 'none'` remain permanent if Doopify is ever embedded inside another admin shell?
