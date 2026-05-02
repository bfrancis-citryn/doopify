# Stripe SDK Migration Plan (Focused, Smallest Safe Slice)

## Goal
Replace the custom Stripe HTTP/fetch helper in `src/lib/stripe.ts` with the official Stripe Node SDK while preserving Doopify checkout/refund/webhook behavior and current DB/runtime credential selection logic.

## Non-Goals
- Do not rebuild checkout, refunds, webhook delivery logging, or webhook processing services.
- Do not change payment/refund business logic.
- Do not change DB schema.
- Do not change Settings provider verification flows beyond what is required to keep behavior identical.

## Current Stripe Helper Usage Audit

`src/lib/stripe.ts` exports:
- `createStripePaymentIntent` (used)
- `createStripeRefund` (used)
- `verifyStripeWebhookSignature` (used)
- `getStripeEvent` (currently unused in `src/`)
- `getStripePublishableKey` (currently unused in `src/`)

Runtime usage sites:
1. PaymentIntent creation
- `src/server/services/checkout.service.ts` (`createCheckoutPaymentIntent`)
- Uses DB-verified Stripe secret first via `getStripeRuntimeConnection()`, then env fallback.

2. Refund creation
- `src/server/services/refund.service.ts` (`issueRefund`)
- `src/server/services/order-adjustments.service.ts` (`createPaymentRefundRecord`)
- Both pass deterministic idempotency key: `refund:${pendingRefund.id}`.

3. Webhook signature verification
- `src/app/api/webhooks/stripe/route.ts`
- Uses `getStripeWebhookSecretSelection()` (DB verified secret preferred, env fallback).

4. Event retrieval
- `getStripeEvent` is defined in `src/lib/stripe.ts` but has no current runtime caller.

## Smallest Safe Implementation Approach

1. Keep adapter surface stable (no service call-site churn)
- Keep existing exported function names/signatures in `src/lib/stripe.ts`.
- Replace internals only:
  - `createStripePaymentIntent` -> `stripe.paymentIntents.create(...)`
  - `createStripeRefund` -> `stripe.refunds.create(..., { idempotencyKey })`
  - `getStripeEvent` -> `stripe.events.retrieve(eventId)`
  - `verifyStripeWebhookSignature` -> `stripe.webhooks.constructEvent(...)`

2. Add SDK dependency
- Add `stripe` dependency in `package.json` (and lockfile update).

3. Centralize Stripe client creation in `src/lib/stripe.ts`
- Build client from:
  - `secretKey` override when passed (preserves DB-runtime credential path)
  - otherwise `env.STRIPE_SECRET_KEY`
- Keep `cache: 'no-store'` behavior equivalent by relying on server-side SDK calls (no fetch cache semantics needed).

4. Preserve current request semantics
- PaymentIntent:
  - `amount`, `currency` (lowercased for Stripe)
  - `automatic_payment_methods.enabled = true`
  - `automatic_payment_methods.allow_redirects = 'never'`
  - optional `receipt_email`
  - metadata pass-through
- Refund:
  - requires `chargeId` or `paymentIntentId`
  - optional `amount`, `reason`
  - idempotency key unchanged

5. Preserve error contract as much as possible
- Continue surfacing actionable message text (Stripe message/code fallback).
- Maintain thrown error phrases that upstream tests and UX depend on where practical.

6. Keep webhook verification tolerance behavior
- Preserve 300-second tolerance default used today.
- Continue failing fast for missing secret/header before processing.
- Continue route-level behavior in `src/app/api/webhooks/stripe/route.ts` unchanged (only helper internals swap).

## Exact Files Likely Touched

Primary implementation files:
- `package.json`
- `package-lock.json`
- `src/lib/stripe.ts`

Likely test updates (if assertions depend on internal behavior or error text):
- `src/lib/stripe.test.ts`
- `src/app/api/webhooks/stripe/route.test.ts`
- `src/server/services/checkout.service.test.ts` (mock surface should remain stable)
- `src/server/services/refund.service.test.ts` (mock surface should remain stable)
- `src/server/services/order-adjustments.service.test.ts` (mock surface should remain stable)

Potentially no-change but verify after compile/test:
- `src/server/services/checkout.service.ts`
- `src/server/services/refund.service.ts`
- `src/server/services/order-adjustments.service.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/server/payments/stripe-runtime.service.ts`

## Risk Notes

1. Webhook signature verification risk
- Risk: Switching from custom HMAC parsing to SDK verification can alter exact failure paths/messages.
- Mitigation: Keep route logic unchanged; preserve explicit missing-secret/header checks before calling SDK; keep tolerance aligned to 300 seconds; update tests for expected behavior, not fragile internal wording.

2. Idempotency key risk (refunds)
- Risk: If idempotency key stops being passed exactly, duplicate refunds become possible under retries.
- Mitigation: Keep `idempotencyKey: refund:${pendingRefund.id}` exactly in both refund paths; assert this in existing tests.

3. DB-backed Stripe credentials vs env fallback risk
- Risk: SDK migration could accidentally always use env key and bypass verified DB runtime credentials.
- Mitigation: Preserve `secretKey` override parameter in adapter and continue passing runtime secret from `getStripeRuntimeConnection()`/selection flows.

4. Env fallback behavior risk
- Risk: Missing-key errors may change and break setup diagnostics UX.
- Mitigation: Keep current guard behavior (`STRIPE_SECRET_KEY is not configured`) in adapter-level validation and preserve route/service error copy where currently user-facing.

5. API version and object shape risk
- Risk: SDK typed objects may differ from the local minimal types consumed by services.
- Mitigation: Keep existing exported local types or map SDK responses into existing minimal shape (`id`, `client_secret`, `latest_charge`, `status`, etc.).

## Execution Sequence (Minimal)
1. Add `stripe` dependency.
2. Swap `src/lib/stripe.ts` internals to SDK with unchanged exports.
3. Run unit tests focused on checkout/refund/webhook routes.
4. Run full verification gate.

## Verification For Migration PR
- `npm run db:generate`
- `npx tsc --noEmit`
- `npm run test`
- `npm run build`
