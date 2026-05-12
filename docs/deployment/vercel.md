# Deploy to Vercel

Deploy Doopify to Vercel with a Neon Postgres database.

---

## Prerequisites

- Vercel account
- Neon Postgres project (free tier works for private beta)
- Stripe account (test mode for beta, production mode before public launch)
- Local install passing the verification gate (see [docs/deployment/local.md](./local.md))

---

## 1. Set up Neon

1. Create a Neon project at [neon.tech](https://neon.tech).
2. Copy the connection strings from the Neon dashboard.
3. Use `sslmode=require` (minimum) or `sslmode=verify-full` (recommended for production).

```
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require
DIRECT_URL=postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require
```

---

## 2. Apply schema

From your local machine with `DATABASE_URL` pointing to Neon:

```bash
npm run db:generate
npm run db:push
```

Or using migrations:

```bash
npm run db:migrate
```

Verify connectivity:

```bash
npm run doopify:db:check
```

---

## 3. Set Vercel environment variables

In the Vercel dashboard under **Settings → Environment Variables**, set all required variables:

**Core (required)**
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET` — 32+ character random secret
- `ENCRYPTION_KEY` — 32+ character random secret
- `NEXT_PUBLIC_STORE_URL` — your production URL (e.g. `https://yourstore.vercel.app`)
- `WEBHOOK_RETRY_SECRET` — 32+ character random secret

**Stripe (required)**
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` — set after step 5

**Optional for private beta**
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `JOB_RUNNER_SECRET`
- `ABANDONED_CHECKOUT_SECRET`

Alternatively, use the CLI helper to push local env vars to Vercel:

```bash
npm run doopify:env:push
```

---

## 4. Deploy

```bash
npm run doopify:deploy
```

Or via Vercel CLI directly:

```bash
npx vercel --prod
```

---

## 5. Register Stripe webhook

After your production URL is live, register the Stripe webhook endpoint:

```bash
npm run doopify:stripe:webhook
```

Set the output `STRIPE_WEBHOOK_SECRET` as a Vercel environment variable and redeploy.

The endpoint to register manually if preferred:
- URL: `https://<your-domain>/api/webhooks/stripe`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`

---

## 6. Create the owner account

Visit `https://<your-domain>/create-owner`.

In production, `SETUP_TOKEN` is required for first-owner bootstrap. Set it as a Vercel environment variable before visiting, then revoke it after account creation. See [docs/setup/first-owner.md](../setup/first-owner.md).

`/create-owner` accepts the token only while no active `OWNER` exists. Once the first owner is created, bootstrap closes permanently.

For private beta, configure Stripe and email in the admin Settings UI after owner creation:
- **Settings -> Payments** for Stripe
- **Settings -> Email** for Resend/SMTP

---

## 7. Configure cron jobs

Doopify uses secret-protected routes for background processing. Configure Vercel Cron (or an external cron service) to call:

| Route | Secret header | Frequency |
|---|---|---|
| `POST /api/jobs/run` | `Authorization: Bearer $JOB_RUNNER_SECRET` | Every 1–5 minutes |
| `POST /api/webhook-retries/run` | `Authorization: Bearer $WEBHOOK_RETRY_SECRET` | Every 1–5 minutes |
| `POST /api/abandoned-checkouts/send-due` | `Authorization: Bearer $ABANDONED_CHECKOUT_SECRET` | Every 30–60 minutes |

A sample `vercel.json` cron configuration:

```json
{
  "crons": [
    { "path": "/api/jobs/run", "schedule": "*/5 * * * *" },
    { "path": "/api/webhook-retries/run", "schedule": "*/5 * * * *" },
    { "path": "/api/abandoned-checkouts/send-due", "schedule": "*/30 * * * *" }
  ]
}
```

Vercel Cron calls do not pass a bearer token by default — use an external scheduler (e.g. cron-job.org) if you need the Authorization header enforced.

---

## 8. Post-deploy smoke check

Run through [docs/operations/pilot-validation-runbook.md](../operations/pilot-validation-runbook.md) before handing off to a merchant.

---

## Rollback

Roll back via the Vercel dashboard → **Deployments** → promote a prior deployment.

If data repair is needed, see [docs/BACKUP_AND_RESTORE.md](../BACKUP_AND_RESTORE.md).

If admin access is broken, see [docs/ADMIN_USER_RECOVERY_GUIDE.md](../ADMIN_USER_RECOVERY_GUIDE.md).
