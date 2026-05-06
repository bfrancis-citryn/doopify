# Doopify RC Report — v0.1 Private Beta

Date: 2026-05-05 (America/Los_Angeles)  
Run timestamp (UTC): 2026-05-06T00:23:55.072Z

## Release Candidate Metadata

- Branch: `release/v0.1-private-beta`
- Commit SHA: `57551219bc0466a15cdc3fc9ca90611fc577c399`
- Vercel project: `doopify-private-beta` (separate from primary production project)
- Deployment URL (alias): `https://doopify-private-beta.vercel.app`
- Latest deployment URL (specific): `https://doopify-private-beta-dwrhbzckh-bfrancis-citryns-projects.vercel.app`

## Database Used

- Provider: Neon Postgres
- Host: `ep-sweet-heart-an7tb43q-pooler.c-6.us-east-1.aws.neon.tech`
- Database: `doopify_private_beta_rc`
- Notes: Fresh RC database; schema applied and then store bootstrap fixed using `scripts/ensure-store.mjs`.

## Setup Steps Performed

1. Checked out `release/v0.1-private-beta`.
2. Confirmed separate Vercel project linkage (`doopify-private-beta`).
3. Verified deployment is reachable at `https://doopify-private-beta.vercel.app`.
4. Validated infrastructure env configuration in Vercel production environment:
   - `DATABASE_URL`, `DIRECT_URL`
   - `JWT_SECRET`, `ENCRYPTION_KEY`
   - `WEBHOOK_RETRY_SECRET`, `JOB_RUNNER_SECRET`, `ABANDONED_CHECKOUT_SECRET`
   - `SETUP_TOKEN`, `OWNER_MFA_GRACE_PERIOD_DAYS`
   - `CSP_MODE`, `NEXT_PUBLIC_STORE_URL`
5. Removed non-infrastructure test env drift (`TMP_API_VAR`).
6. Confirmed first-run owner flow state:
   - `GET /api/bootstrap/owner` -> `bootstrapAvailable: false`
7. Fixed initial shipping/settings bootstrap issue by creating store row:
   - `node scripts/ensure-store.mjs` against RC DB
8. Configured shipping baseline through app APIs:
   - `PATCH /api/settings/shipping` -> `200`
   - `POST /api/settings/shipping/manual-rates` -> `201`
9. Created release-candidate storefront product:
   - `POST /api/products` -> `201`
10. Invited and accepted team member invite:
    - `POST /api/team/invites` -> `201`
    - `POST /api/team/invites/accept` -> `200`
11. Validated role permissions:
    - Admin attempt on owner-only credentials route -> `403`
12. Validated password reset + change-password flow:
    - Owner reset token issue -> `200`
    - Reset completion -> `200`
    - Admin login after reset -> `200`
    - Authenticated password change -> `200`
    - Admin login after change -> `200`

## Smoke Checklist Result

### Phase 27 task matrix

1. Create `release/v0.1-private-beta` branch — **PASS**
2. Deploy to separate Vercel project — **PASS**
3. Use separate Postgres database — **PASS**
4. Do not configure Stripe env fallback — **PASS**
5. Configure only infrastructure env vars — **PASS** (after removing temporary debug env var)
6. Use first-run owner flow — **PASS**
7. Connect Stripe through Settings -> Payments — **BLOCKED**
8. Configure shipping — **PASS**
9. Configure email — **BLOCKED**
10. Create product — **PASS**
11. Run Stripe test checkout — **BLOCKED**
12. Confirm webhook 200 — **BLOCKED** (`/api/webhook-deliveries` total: `0`)
13. Confirm order appears — **BLOCKED** (`/api/orders` total: `0`)
14. Confirm inventory decrements — **BLOCKED** (no paid order created)
15. Fulfill order with tracking — **BLOCKED** (no order available)
16. Confirm shipping email — **BLOCKED** (no fulfillment/email trigger path reached)
17. Invite team member — **PASS**
18. Test role permissions — **PASS** (non-owner sensitive write correctly denied: `403`)
19. Test password reset/change password — **PASS**
20. Complete pilot smoke checklist — **PARTIAL** (all non-payment gates passed; payment-dependent gates blocked)

### Pilot-critical evidence

- Stripe provider verification endpoint:
  - `POST /api/settings/providers/stripe/verify` -> `200`
  - verification result: `ok=false`
  - message indicates invalid Stripe key configured in provider credentials.
- Stripe webhook deliveries in RC env:
  - `GET /api/webhook-deliveries?provider=STRIPE&page=1&pageSize=5` -> total `0`
- Orders in RC env:
  - `GET /api/orders?page=1&pageSize=5` -> total `0`

## Audit Evidence

Recent audit events observed in RC DB include:

- `audit.shipping.settings_updated`
- `audit.provider.verification_attempted`
- `audit.team.invite_created`
- `audit.team.invite_accepted`
- `audit.team.password_reset_requested`
- `audit.team.password_reset_completed`
- `audit.auth.password_changed`

## Verification Commands

All required local verification commands passed on this branch/commit:

- `npm run db:generate` -> PASS
- `npx tsc --noEmit` -> PASS
- `npm run test` -> PASS (`132` files, `767` tests)
- `npm run build` -> PASS

## Blockers

### P0 (must fix before private-beta real user test)

- Stripe connection is not valid in Settings (invalid API key), preventing payment flow validation.
- No successful Stripe checkout executed in RC environment.
- No Stripe webhook `payment_intent.succeeded` observed with HTTP 200.
- No paid order creation / inventory decrement / fulfillment + tracking + shipping email path validated end-to-end.

### P1 (should fix before pilot handoff)

- Setup status still reports `storeConfigured: false` despite shipping routes functioning after store-row bootstrap; setup-status signal requires reconciliation so operators are not misled.
- Email provider configuration for RC remains incomplete/unverified.

### P2 (nice-to-have hardening before broader beta)

- Add an automated RC smoke runner checked into `scripts/` for repeatable pilot sign-off (owner bootstrap, shipping setup, team permissions, password lifecycle, checkout/webhook assertions when Stripe keys are present).

## Final Readiness Grade

**Grade: D (Not Ready for private-beta real user test yet).**

Reason: infrastructure, auth/team, and shipping baselines are functional, but the payment trust path (Stripe checkout -> webhook 200 -> paid order -> inventory decrement -> fulfillment email) is unvalidated due unresolved Stripe credential/configuration blockers.
