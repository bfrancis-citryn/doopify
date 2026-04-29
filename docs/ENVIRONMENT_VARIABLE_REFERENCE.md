# Environment Variable Reference

> Runtime and CLI environment variable reference for production operations.
>
> Last updated: April 29, 2026

## Runtime Core

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Primary Postgres connection string used by Prisma/runtime. |
| `DIRECT_URL` | Recommended | Direct Postgres URL used by Prisma tooling/migrations. |
| `JWT_SECRET` | Yes | Auth JWT signing secret. Use high-entropy value. |
| `NEXT_PUBLIC_STORE_URL` | Yes | Public base URL used for setup/deployment checks and links. |
| `WEBHOOK_RETRY_SECRET` | Yes | Auth secret for `POST /api/webhook-retries/run`. |

## Stripe

| Variable | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes | Server-side Stripe API key for checkout and refunds. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Client-side Stripe key for checkout UI. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe signing secret used to verify `/api/webhooks/stripe`. |

## Resend / Email Provider

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Optional (required for live sends) | Enables live transactional email sends. |
| `RESEND_WEBHOOK_SECRET` | Required when email provider webhooks enabled | Svix signing secret for `/api/webhooks/email-provider`. |

## Setup / Bootstrap Helpers

| Variable | Required | Purpose |
| --- | --- | --- |
| `DOOPIFY_STORE_NAME` | Setup-time | Store bootstrap name used by setup tooling. |
| `DOOPIFY_STORE_EMAIL` | Setup-time | Store bootstrap email used by setup tooling. |
| `DOOPIFY_ADMIN_EMAIL` | Setup-time | Owner/admin bootstrap account email. |
| `DOOPIFY_ADMIN_PASSWORD` | Setup-time | Owner/admin bootstrap password. |

## Deployment Automation Helpers

| Variable | Required | Purpose |
| --- | --- | --- |
| `VERCEL_TOKEN` | For `env push`/`deploy` | Vercel auth token for CLI/API automation. |
| `VERCEL_PROJECT_ID` or `VERCEL_PROJECT_NAME` | For `env push`/`deploy` | Vercel project target identifier. |
| `VERCEL_TEAM_ID` or `VERCEL_TEAM_SLUG` | Optional | Team scope for Vercel project actions. |

## Test-Only

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL_TEST` | For integration tests | Disposable Postgres target for `npm run test:integration`. |

## Notes

- Keep database URLs in `.env`.
- Keep app/runtime secrets in `.env.local`.
- Never commit real credentials.
- Rotate production secrets after incident response or compromise suspicion.
