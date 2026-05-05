# Release Blockers

Tracks what must be fixed before each launch milestone. Update this file as items are resolved or discovered.

Last updated: May 3, 2026

---

## Must fix before private beta

These are blocking. Do not launch with any of these unresolved.

- Stripe must be configured and verified before checkout is enabled for users. If Stripe keys are missing or unverified, checkout will fail.
- At least one active product with a valid price and available inventory must exist. No product = no orders.
- Shipping must have at least one ready method (manual or live) or checkout cannot calculate shipping.
- Tax must either be configured (rate > 0) or explicitly disabled. An ambiguous tax state (enabled but no rate) will produce incorrect order totals.
- NEXT_PUBLIC_STORE_URL must be set. Without it, storefront links, email links, and recovery flows break.
- DATABASE_URL must be reachable and the schema must be current. Run `npm run db:push` and `npm run db:generate` before deploy.
- JWT_SECRET must be at least 32 characters and not a placeholder. Weak secrets allow session forgery.
- ENCRYPTION_KEY must be set in production before configuring any integration providers. Without it, provider credentials cannot be encrypted at rest.
- STRIPE_WEBHOOK_SECRET must be registered at `/api/webhooks/stripe` and must match the Stripe endpoint signing secret. Without it, orders cannot be finalized.
- Pilot validation runbook must be completed before opening to any merchant. See `docs/PILOT_VALIDATION_RUNBOOK.md`.

---

## Should fix before public beta

These are not blockers for private beta but must be resolved before opening to the public.

- WEBHOOK_RETRY_SECRET should be set. Without it, webhook retry routes are unprotected. Low risk for private beta with trusted testers; higher risk with unknown users.
- Email provider should be configured for transactional emails (order confirmations, refund notices). Missing email degrades merchant trust at scale.
- RESEND_WEBHOOK_SECRET should be set if live email sending is enabled. Bounce and complaint signals from Resend will not be verified without it.
- Product images should be added to active products. Storefront conversion is measurably lower without media.
- Review and finalize tax strategy for the target jurisdiction before public orders are placed.
- Confirm Stripe webhook endpoint is registered and the signing secret matches STRIPE_WEBHOOK_SECRET.

---

## Can wait until after beta

These are improvements for a stable public release, not blockers.

- Object storage configuration (S3-compatible) for persistent media at scale. Postgres storage is acceptable for private beta.
- Live shipping rates via Shippo or EasyPost (manual rates are sufficient for early volume).
- SendLayer email provider (coming soon — not available yet).
- Vercel deployment automation (`doopify:env:push`, `doopify:deploy` commands).
- Multi-timezone support for order timestamps in the admin.
- Analytics event fan-out configuration for external dashboards.
- Abandoned checkout recovery email tuning (interval, template copy).
- CSP enforcement (`CSP_MODE=enforce`). Report-only mode is acceptable for private beta.
- Explicit `DOOPIFY_RATE_LIMIT_STORE=postgres` override if running a single Vercel instance (auto-defaults to Postgres in production).
- CSP report ingestion endpoint for violation monitoring.
