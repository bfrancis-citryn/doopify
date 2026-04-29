# Webhook Configuration Guide

> Provider webhook targets and expected configuration for Doopify production.
>
> Last updated: April 29, 2026

## Endpoints

- Stripe: `POST /api/webhooks/stripe`
- Email provider (Resend): `POST /api/webhooks/email-provider`
- Retry runner (internal cron path): `POST /api/webhook-retries/run`

## Stripe Webhook

### Required event types

- `payment_intent.succeeded`
- `payment_intent.payment_failed`

### Requirements

- Endpoint URL must be publicly reachable over HTTPS.
- Configure `STRIPE_WEBHOOK_SECRET` from Stripe endpoint signing secret.
- Keep checkout/order finalization server-owned through verified webhooks.

## Resend Webhook

### Required event types

- `email.bounced`
- `email.complained`

### Requirements

- Endpoint URL must be publicly reachable over HTTPS.
- Configure `RESEND_WEBHOOK_SECRET` for Svix verification.
- Use `RESEND_API_KEY` for live email sending.

## Retry Runner Webhook Security

`POST /api/webhook-retries/run` requires one of:

- `Authorization: Bearer <WEBHOOK_RETRY_SECRET>`
- `x-webhook-retry-secret: <WEBHOOK_RETRY_SECRET>`

## CLI Automation

Use shipped setup helpers:

```bash
npm run doopify:stripe:webhook
```

This command automates Stripe endpoint setup and Resend webhook creation/update when `RESEND_API_KEY` is available.

## Validation Checklist

- [ ] Stripe events appear in `/admin/webhooks` inbound table
- [ ] Resend events appear in `/admin/webhooks` inbound table
- [ ] Signature failures are visible and actionable
- [ ] Retry metadata is recorded for failed deliveries
