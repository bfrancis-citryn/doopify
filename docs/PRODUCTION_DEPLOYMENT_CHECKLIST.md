# Production Deployment Checklist

> Repeatable launch checklist for early production users.
>
> Last updated: April 29, 2026

## Preconditions

- [ ] `main` is green in GitHub Actions CI (`.github/workflows/ci.yml`)
- [ ] Required production secrets are available
- [ ] Neon project/branch is ready for production traffic
- [ ] Stripe account and webhook endpoint are configured
- [ ] Resend domain and webhook endpoint are configured

## 1. Local Verification Gate

Run before deploying:

```bash
npm ci
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

Optional integration pass when disposable Postgres is configured:

```bash
DATABASE_URL_TEST="postgresql://..." npm run test:integration
```

## 2. Configure App Locally

Use guided setup:

```bash
npm run doopify:setup
```

Then run deployment setup actions:

```bash
npm run doopify:db:check
npm run doopify:stripe:webhook
npm run doopify:env:push
```

## 3. Deploy

Use the CLI deploy flow:

```bash
npm run doopify:deploy
```

This runs:

- production build preflight
- optional DB check
- optional webhook automation
- optional Vercel env sync
- Vercel production deployment command

## 4. Post-Deploy Smoke Checks

- [ ] `/login` renders
- [ ] admin login works
- [ ] `/settings` loads, including Setup tab
- [ ] Setup tab shows no required failures
- [ ] `POST /api/webhooks/stripe` receives Stripe events successfully
- [ ] `POST /api/webhooks/email-provider` receives provider events successfully
- [ ] checkout success creates order only after verified webhook success

## 5. Release Claim Guardrails

Do not claim production readiness unless:

- CI is passing on current commit
- deployment checklist completed
- backup/restore path validated
- admin recovery runbook tested
- known risks documented in `docs/HARDENING.md`

## 6. Rollback Path

If release causes severe regression:

1. Roll back to previous Vercel deployment using Vercel dashboard or CLI.
2. Validate core routes and webhook processing.
3. If data repair is needed, use `docs/BACKUP_AND_RESTORE.md`.
4. If admin access is broken, use `docs/ADMIN_USER_RECOVERY_GUIDE.md`.

