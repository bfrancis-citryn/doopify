# Secret Rotation Runbook

> Operational rotation checklist for production credentials and signing secrets.
>
> Last updated: May 5, 2026

## Scope

Rotate these secrets regularly and after any suspected exposure:

- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`
- shipping provider API keys (EasyPost/Shippo)
- `WEBHOOK_RETRY_SECRET`
- `JOB_RUNNER_SECRET`
- `ABANDONED_CHECKOUT_SECRET`
- database credentials / `DATABASE_URL`

## Rotation Cadence

- High-impact credentials (JWT/encryption/database/payment/webhook): every 90 days.
- Lower-impact operational secrets: every 90-180 days.
- Immediate rotation after incident response confirms or suspects leakage.

## Standard Rotation Procedure

1. Prepare new secret values in your secret manager.
2. Update non-production first and run:
   - `npm run db:generate`
   - `npx tsc --noEmit`
   - `npm run test`
   - `npm run build`
3. Deploy production with both old/new overlap where supported by provider APIs.
4. Verify:
   - admin authentication and session creation
   - checkout creation and Stripe webhook finalization
   - background job runner authentication
   - provider webhook verification and outbound webhook retries
5. Remove old values after validation window.
6. Record rotation date, owner, and verification evidence.

## Special Notes

### JWT Secret

- Rotating `JWT_SECRET` immediately invalidates existing sessions.
- Announce maintenance impact before production cutover.

### Encryption Key

- Existing encrypted rows (provider secrets, integration headers, MFA secrets) depend on `ENCRYPTION_KEY`.
- Use a controlled migration plan before changing it in production.
- Do not rotate encryption key ad hoc without a re-encryption strategy.

### Stripe + Webhooks

- Rotate Stripe API credentials and webhook signing secrets together when possible.
- Ensure webhook endpoint signatures still verify after cutover.

## Logging and Evidence

- Never log raw secret values.
- Store only metadata in change records:
  - what changed
  - when it changed
  - who approved and executed rotation
  - validation outcomes
