# Stripe Setup Guide

> Production setup steps for checkout and webhook finalization.
>
> Last updated: April 29, 2026

## 1. API Keys

Set:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Use production keys for live mode.

## 2. Configure Webhook Endpoint

Endpoint:

- `https://<your-domain>/api/webhooks/stripe`

Subscribe to:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Store webhook signing secret as:

- `STRIPE_WEBHOOK_SECRET`

## 3. CLI Automation

Use:

```bash
npm run doopify:stripe:webhook
```

This command can create/update the Stripe webhook endpoint and sync secret locally when returned by Stripe.

## 4. Validate Commerce Path

- Complete a test checkout.
- Verify order appears only after webhook success.
- Verify inventory decrement occurs only after verified success.
- Confirm webhook logs in `/admin/webhooks`.

## 5. Safety Notes

- Browser redirect success is not order truth.
- Stripe webhook verification is required for finalization.
