# Recent Updates

## Post Phase 16/17 Audit and Build Repair (2026-05-03)

**Goal:** Fix build blocker, repair pre-existing test failures, audit Phase 16/17 correctness, pass all verification gates.

**Changes:**

- `src/server/services/product.service.ts` — Removed corrupted duplicate tail (lines 853–982). The file ended correctly at the first `slugify()` function at line 852. The duplicate contained stray `ng` plus re-pasted `upsertOptions` fragment, `decrementInventory`, `archiveProduct`, `getStorefrontProducts`, and a second `slugify`. All first valid implementations (lines 720–852) are preserved unchanged.

- `src/components/webhooks/delivery-logs.copy.test.ts` — Fixed stale file extension reference: `AdminCommandPalette.jsx` → `AdminCommandPalette.tsx`. The file was converted to TypeScript; the test still read the old `.jsx` path.

- `src/components/settings/SettingsWorkspace.test.ts` — Updated stale assertion: `paypal?.sourceMeta` expected `'not implemented'` but the helper returns `'Runtime support: unavailable'`. Updated to match the actual string.

- `src/server/services/deployment-validation.service.ts` — Removed unused `mediaPublicBaseUrlPresent` fact field. Per `docs/MEDIA_OBJECT_STORAGE_PLAN.md`, `MEDIA_PUBLIC_BASE_URL` is optional: without it, S3 assets are streamed through `/api/media/{assetId}`. The fact was collected but never used in any check.

- `src/app/api/deployment-validation/route.ts` — Removed corresponding unused `mediaPublicBaseUrlPresent` env read.

- `src/server/services/deployment-validation.service.test.ts` — Removed `mediaPublicBaseUrlPresent: false` from `baseFacts()` to match updated type.

**Phase 16 audit result:**
- `buildLaunchReadinessReport(facts)` is pure (no DB or env access). ✅
- `/api/readiness` is owner-only via `requireOwner`. ✅
- Response contains only booleans and safe string literals (source labels like `'db'/'env'/'none'`). No raw secrets. ✅
- All 11 readiness checks are accurate: store profile, Stripe runtime (real DB-verified vs env-fallback source), shipping (uses real `buildShippingSetupStatus`), tax (distinguishes enabled/disabled/unconfigured), active products, product price, product inventory, product media (optional), storefront URL, email provider (optional), webhook retry secret (optional). ✅
- Product facts are lightweight: targeted `select` on `id`, `isFeatured` media id, `priceCents`, and `inventory` only. ✅
- `webhook-jobs` check has `optional: true` — consistent with `RELEASE_BLOCKERS.md` placing WEBHOOK_RETRY_SECRET in "Should fix before public beta" (not a private-beta blocker). ✅

**Phase 17 audit result:**
- `buildDeploymentValidationReport(facts)` is pure (no DB or env access). ✅
- `/api/deployment-validation` is owner-only via `requireOwner`. ✅
- Response contains only booleans and safe labels. No raw secrets or credential values. ✅
- ENCRYPTION_KEY missing in production is a non-optional blocker (`blockerCount > 0`). ✅
- S3 vars missing when `MEDIA_STORAGE_PROVIDER=s3` is a non-optional blocker. ✅
- Rate-limit `memory` store in production is flagged as `needs_setup`. ✅
- Job runner auth: `JOB_RUNNER_SECRET` or `WEBHOOK_RETRY_SECRET` fallback required. ✅
- Abandoned checkout auth: `ABANDONED_CHECKOUT_SECRET` or `WEBHOOK_RETRY_SECRET` fallback. ✅
- `mediaPublicBaseUrlPresent` was unused dead plumbing — removed. ✅

**Verification results:**
- `npm run db:generate` — PASS
- `npx tsc --noEmit` — PASS (0 errors)
- `npm run test` — PASS (111/111 test files, 513/513 tests)
- `npm run build` — PASS
- `npm run test:integration` — SKIPPED (DATABASE_URL_TEST not configured)

---


## Phase 17 — Deployment and Pilot Validation (2026-05-03)

**Goal:** Prepare Doopify for a controlled private merchant pilot by validating deployment readiness, environment configuration, and operational recovery paths.

**What shipped:**

- `src/server/services/deployment-validation.service.ts` — Pure, testable service. Accepts `DeploymentValidationFacts` and returns a `DeploymentValidationReport` with per-check statuses covering encryption key, object storage provider, rate limit store, CSP mode, job runner auth, and abandoned checkout auth.

- `src/app/api/deployment-validation/route.ts` — Owner-only GET endpoint. Gathers deployment-level facts from environment variables and returns the full validation report.

- `src/components/settings/SettingsWorkspace.js` — Added a **Deployment validation** panel to the existing Setup tab, below the Phase 16 Launch readiness panel. Shows server-derived status for each infrastructure check. Has a Refresh button.

- `src/server/services/deployment-validation.service.test.ts` — 12 focused unit tests covering all-ready, encryption key missing in production (blocker) vs dev (optional), S3 mode with all vars (ready), S3 mode with missing vars (needs_setup), Postgres fallback (optional), rate limit store memory-in-production (needs_setup), rate limit not set in production (ready, auto-defaults), job runner auth with fallback secret (ready), job runner auth missing (optional/non-blocking), and count consistency.

**Checks covered by deployment validation:**
1. Encryption key (required in production for integration secret encryption)
2. Object storage provider (Postgres default vs S3 mode + required vars)
3. Rate limit store (in-memory vs Postgres for multi-instance)
4. CSP mode (off / report-only / enforce)
5. Job runner auth (JOB_RUNNER_SECRET or WEBHOOK_RETRY_SECRET fallback)
6. Abandoned checkout auth (ABANDONED_CHECKOUT_SECRET or WEBHOOK_RETRY_SECRET fallback)

**Docs updated/created:**
- `docs/ENVIRONMENT_VARIABLE_REFERENCE.md` — Added Media/Object Storage, Security/CSP, and Rate Limiting env var sections (MEDIA_STORAGE_PROVIDER, MEDIA_S3_*, CSP_MODE, CSP_MEDIA_ORIGINS, DOOPIFY_RATE_LIMIT_STORE).
- `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` — Expanded to cover full env var checklist, multi-provider setup, post-deploy smoke checks, and rollback path.
- `docs/RELEASE_BLOCKERS.md` — Added ENCRYPTION_KEY and STRIPE_WEBHOOK_SECRET as private beta blockers. Added pilot runbook reference. Added post-beta items.
- `docs/PILOT_VALIDATION_RUNBOOK.md` — Created. Covers staging assumptions, env checklist, provider setup, test product setup, Stripe test checkout, webhook verification, inventory, email, shipping/tax, media/object storage, cron/job runner, refund, return, outbound webhook delivery, backup/restore, rollback, and pilot acceptance checklist.

**Hard boundaries respected:**
- No checkout/payment/order logic changed.
- No admin UI redesigned (used existing AdminCard, AdminStatusChip, AdminButton).
- No JSX/TSX converted.
- No new providers introduced.
- No broad account tokens stored.
- All checks use real env/runtime state — no fake readiness claims.

---


## Phase 16 — Merchant Launch Readiness (2026-05-03)

**Goal:** Give merchants a clear, server-derived readiness path from setup to first test order.

**What shipped:**

- `src/server/services/launch-readiness.service.ts` — Pure, testable readiness service. Accepts `LaunchReadinessFacts` and returns a `LaunchReadinessReport` with per-check statuses: `ready`, `needs_setup`, `optional`, `skipped`.

- `src/app/api/readiness/route.ts` — Owner-only GET endpoint. Gathers facts from the database, Stripe runtime, shipping setup service, email provider runtime, and environment. Returns the full readiness report.

- `src/components/settings/SettingsWorkspace.js` — Added a **Launch readiness** checklist to the existing Setup tab. Shows server-derived status for each launch requirement. Loads lazily on tab activation. Has a Refresh button.

- `src/server/services/launch-readiness.service.test.ts` — 13 focused unit tests covering all-ready, missing Stripe, missing shipping, tax disabled (skipped), tax enabled with no rate (needs_setup), no active products, no inventory, email skipped (does not block), webhook retry optional, product media optional, env-only Stripe (ready), and count consistency.

**Readiness checks covered:**
1. Store profile (name + contact email)
2. Stripe payments (real runtime source: db-verified, env-fallback, or none)
3. Shipping rates (manual or live — uses existing `buildShippingSetupStatus`)
4. Tax (ready / needs_setup / skipped when intentionally disabled)
5. Active products (count)
6. Product pricing (at least one active product with price > 0)
7. Product inventory (at least one active product with inventory > 0)
8. Product media (optional)
9. Storefront URL
10. Email provider (optional — does not block launch)
11. Webhook retry secret (optional — informational)

**Docs added:**
- `docs/MERCHANT_LAUNCH_GUIDE.md` — Full install-to-launch walkthrough.
- `docs/RELEASE_BLOCKERS.md` — Categorized blocker list (private beta / public beta / after beta).

**Hard boundaries respected:**
- No checkout/payment/order logic changed.
- No admin UI redesigned (used existing AdminCard, AdminStatusChip, AdminButton).
- No JSX/TSX converted.
- No new visual system introduced.
- No fake readiness checks — all checks reflect real runtime state.
- No shell commands from browser.
- Existing API response shapes unchanged (new endpoint only).
