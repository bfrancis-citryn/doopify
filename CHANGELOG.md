# Changelog

All notable changes to Doopify are documented here.

---

## Phase 22 — Release Repo Cleanup and First-Run Experience (May 2026)

- Reorganized docs into `docs/deployment/`, `docs/setup/`, `docs/operations/`, `docs/architecture/`, `docs/internal/`
- Moved 17 internal planning docs to `docs/internal/`
- Rewrote README as product-facing private-beta documentation
- Added `docs/quickstart.md` — 15-minute path from clone to first sale
- Added `docs/deployment/vercel.md` and `docs/deployment/local.md`
- Added `docs/setup/first-owner.md`, `stripe.md`, `shipping.md`, `email.md`, `team.md`
- Added `docs/architecture/checkout.md` and `docs/architecture/events.md`
- Added `docs/security.md` with security model, beta limitations, and hardening checklist
- Added `docs/troubleshooting.md` covering 8 common failure modes
- Updated `.env.example` with media storage vars, `SETUP_TOKEN`, rate-limit and CSP controls
- Updated `AGENTS.md` to Phase 21 state with revised required reading links
- Added root `LICENSE` (MIT), `CHANGELOG.md`, and `CONTRIBUTING.md`

---

## Phase 21 — Account Recovery, Security, and Team Completion (May 2026)

- `SETUP_TOKEN` required in production for first-owner bootstrap
- Change-my-password flow: `PATCH /api/auth/password`
- Password reset flow with 24-hour expiring hashed tokens; all sessions revoked on accept
- `PasswordReset` Prisma model
- Session management: view and revoke sessions (owner for any user, user for own other sessions)
- `requireAdminOrAbove` helper (OWNER + ADMIN)
- Full audit logging for team operations, password events, and session revocations
- `scripts/reset-owner.mjs` CLI recovery tool (`npm run doopify:reset-owner`)
- Settings → My account panel with change-password and revoke-other-sessions

---

## Phase 20 — Pilot Polish and Merchant Operations (May 2026)

- Order detail UI fully rewritten with labeled status chips and split fulfillment/creation cards
- Live shipping rate integration: EasyPost and Shippo adapters calling real provider APIs
- Label purchase bug fix: shipment ID passed from rates call to label purchase
- Shipping rate matching: `min(0)` validation, specific error messages for mismatches
- Transactional email verification: order confirmation and shipping confirmation flows
- Email preview mode: marks deliveries FAILED with clear reason when no provider configured
- Pilot smoke checklist added

---

## Phase 4 — Merchant Lifecycle and Outbound Integrations (April 2026)

- Refund service with Stripe idempotency, pending persistence, item-level restocking
- Return service with state-machine transitions and close-with-refund
- Outbound merchant webhooks with HMAC signing, retry/backoff, dead-letter observability
- Transactional email delivery tracking with Resend adapter and provider webhook handling
- Analytics event fan-out through the typed dispatcher
- Abandoned checkout recovery with tokenized recovery links
- Background job infrastructure with claiming, retry, exhaustion, and cron runner
- Production security headers: baseline, HSTS, CSP report-only mode
- Provider credential audit logging
- GitHub Actions CI workflow
- Media object storage adapter (Postgres default, S3-compatible optional)

---

## Phase 3 — Commerce Hardening (March–April 2026)

- Collection service layer with storefront-safe DTOs and publish/unpublish semantics
- Checkout pricing hardening: discounts, shipping zones, tax rules, jurisdiction matching
- Durable Stripe webhook replay/retry/diagnostics
- Shared rate-limit store and Postgres SSL normalization
- Real-DB integration tests for revenue path, inventory, discount caps, and webhook idempotency

---

## Earlier phases

See `docs/features-roadmap.md` for full phase history and build sequencing.
