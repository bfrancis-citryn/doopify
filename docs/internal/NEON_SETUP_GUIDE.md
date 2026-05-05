# Neon Setup Guide

> Production setup steps for Neon Postgres with Doopify.
>
> Last updated: April 29, 2026

## 1. Create Project and Branch

1. Create Neon project.
2. Use a dedicated production branch (typically `main`).
3. Restrict credentials to least privilege where possible.

## 2. Configure Connection Strings

Set:

- `DATABASE_URL` (app/runtime connection)
- `DIRECT_URL` (direct connection for Prisma tooling)

For production, prefer explicit SSL mode:

- `sslmode=verify-full`

## 3. Bootstrap Schema

Run:

```bash
npm run db:generate
npm run db:push
```

Or use migrations when your workflow requires them:

```bash
npm run db:migrate
```

## 4. Validate Connectivity

Run:

```bash
npm run doopify:db:check
```

Expected output includes:

- host detection
- Neon host identification
- SSL mode summary
- basic store/owner counts

## 5. Operational Recommendations

- Do not run integration tests against production databases.
- Use branch-based restore workflows for incident recovery.
- Pair Neon restore capabilities with periodic logical dumps for defense in depth.
