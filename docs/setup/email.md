# Email Setup

Configure transactional email delivery for order confirmations and shipping notifications.

Email is **optional for private beta**. Without a provider, the system operates in preview mode — emails are logged but not sent. The launch readiness panel marks email as optional, not a blocker.

---

## Supported providers

- **Resend** (recommended)
- **SMTP** (any provider)

---

## Resend setup

**1. Create API key**

In the Resend dashboard, create an API key with send permissions.

Set:
```
RESEND_API_KEY=re_...
```

**2. Verify sending domain**

Add and verify your sending domain in Resend. Confirm SPF/DKIM/DMARC records are valid before public launch.

**3. Configure in admin**

Go to **Settings → Email** in the admin. Open the Resend drawer and save your API key.

**4. Register bounce/complaint webhook (recommended)**

Register the email provider webhook endpoint:
- URL: `https://<your-domain>/api/webhooks/email-provider`
- Events: `email.bounced`, `email.complained`

Set:
```
RESEND_WEBHOOK_SECRET=whsec_...
```

This enables bounce and complaint tracking in the admin delivery log.

---

## SMTP setup

Set these environment variables:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=noreply@example.com
```

---

## Transactional email flows

| Template | Trigger | Delivery logged |
|---|---|---|
| Order confirmation | `payment_intent.succeeded` webhook | Yes |
| Shipping confirmation | Manual fulfillment with tracking | Yes |

---

## Delivery observability

Go to **System → Delivery logs** → Email tab in the admin to see:
- Delivery status (`SENT`, `FAILED`, `BOUNCED`, `COMPLAINED`)
- Provider metadata
- Resend controls for failed/bounced deliveries

Failed order confirmations can be resent without duplicating commerce side effects (no re-decrement of inventory, no re-creation of orders).

---

## Preview mode (no provider configured)

If no email provider is set, delivery records are created and marked `FAILED` with the reason `"No email provider configured"`. This lets you verify the email flow in development without a live provider.
