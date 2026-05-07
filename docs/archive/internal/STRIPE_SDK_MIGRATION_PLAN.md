# Stripe SDK Migration Plan

Status: **complete** as of May 1, 2026.

## Goal
Replace the custom Stripe HTTP/fetch helper in `src/lib/stripe.ts` with the official Stripe Node SDK while preserving Doopify checkout/refund/webhook behavior and current DB/runtime credential selection logic.

## Completion Summary

Shipped:

- `stripe` is installed as a production dependency.
- `src/lib/stripe-client.ts` centralizes Stripe SDK client creation.
- `createStripePaymentIntent()` now uses `stripe.paymentIntents.create(...)`.
- `createStripeRefund()` now uses `stripe.refunds.create(..., { idempotencyKey })`.
- `getStripeEvent()` now uses `stripe.events.retrieve(eventId)`.
- `verifyStripeWebhookSignature()` now uses the official SDK webhook verifier.
- Existing exported function names and service call surfaces were preserved.
- DB-backed Stripe secret override behavior is preserved for checkout/refund/runtime flows.
- Env fallback remains available where no verified DB runtime credential exists.
- Refund idempotency-key call paths remain owned by refund/order-adjustment services.
- Webhook route behavior remains unchanged: DB verified webhook secret preferred, env fallback second, missing secret fails closed.

## Non-Goals

- Do not rebuild checkout, refunds, webhook delivery logging, or webhook processing services.
- Do not change payment/refund business logic.
- Do not change DB schema.
- Do not change Settings provider verification flows beyond what is required to keep behavior identical.

## Current Stripe Helper Usage Audit

`src/lib/stripe.ts` exports:

- `createStripePaymentIntent`
- `createStripeRefund`
- `verifyStripeWebhookSignature`
- `getStripeEvent`
- `getStripePublishableKey`

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
- Uses `getStripeWebhookSecretSelection()` with DB verified secret preferred and env fallback.

4. Event retrieval

- `getStripeEvent` remains available for replay/support flows that need direct Stripe event retrieval.

## Preserved Request Semantics

PaymentIntent:

- `amount`
- lowercased `currency`
- `automatic_payment_methods.enabled = true`
- `automatic_payment_methods.allow_redirects = 'never'`
- optional `receipt_email`
- metadata pass-through after dropping undefined values

Refund:

- requires `chargeId` or `paymentIntentId`
- optional integer-rounded `amount`
- optional `reason`
- idempotency key passed through Stripe SDK request options

Webhook verification:

- missing webhook secret fails closed
- missing `Stripe-Signature` header fails closed
- official SDK verifier performs timestamp/signature validation
- 300-second tolerance remains the default
- known SDK error messages are normalized to stable local errors for route/test behavior

## Files Touched By Migration

Primary files:

- `package.json`
- `src/lib/stripe-client.ts`
- `src/lib/stripe.ts`
- `src/lib/stripe.test.ts`

Verified call surfaces:

- `src/server/services/checkout.service.ts`
- `src/server/services/refund.service.ts`
- `src/server/services/order-adjustments.service.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/server/payments/stripe-runtime.service.ts`

## Risk Notes

1. Webhook signature verification

- The app now depends on the official SDK verifier rather than custom HMAC parsing.
- Route-level behavior remains unchanged and still fails closed before processing.

2. Idempotency key preservation

- Refund idempotency remains a service-level invariant.
- The Stripe helper passes the idempotency key through SDK request options.

3. DB-backed Stripe credentials vs env fallback

- SDK migration preserved the `secretKey` override parameter.
- Runtime services can continue to pass verified DB credentials first.

4. API object shape

- SDK objects are mapped back into Doopify's minimal local DTO shapes to avoid downstream churn.

## Verification

Run after pulling the latest `master`:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
npm run test:integration
```

`npm run test:integration` requires a disposable `DATABASE_URL_TEST` database/schema.
