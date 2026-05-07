# Resend Setup Guide

> Production setup steps for transactional email delivery and webhook observability.
>
> Last updated: April 29, 2026

## 1. Create API Key

In Resend dashboard:

1. Create a production API key.
2. Store it as `RESEND_API_KEY`.

## 2. Verify Sending Domain

1. Add and verify your sending domain in Resend.
2. Confirm SPF/DKIM/DMARC records are valid before launch claims.

## 3. Configure Provider Webhook

1. Register webhook endpoint:
   - `https://<your-domain>/api/webhooks/email-provider`
2. Subscribe to:
   - `email.bounced`
   - `email.complained`

Use CLI automation:

```bash
npm run doopify:stripe:webhook
```

That command can create/update Resend webhook and persist `RESEND_WEBHOOK_SECRET`.

## 4. Environment Variables

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`

## 5. Verify In-App Observability

- Open `/admin/webhooks`
- Switch to email delivery/inbound view
- Confirm events and status transitions are visible

## 6. Failure Handling

- Failed or bounced order confirmations can be safely resent through admin controls.
- Do not re-emit core commerce side effects from resend workflows.
