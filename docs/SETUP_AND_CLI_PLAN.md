# Setup Wizard And CLI Plan

> Deployment setup plan for Doopify.
>
> Created: April 28, 2026
> Status: active foundation; Phase A (`doopify doctor`) shipped on April 28, 2026

## Goal

Make Doopify easier for a developer or merchant-operator to install, configure, verify, and deploy without manually stitching together database setup, environment variables, Stripe webhooks, Vercel deployment, and seed/bootstrap commands.

The target experience is:

1. User clones or deploys the repo.
2. User runs a local CLI command such as `npx doopify setup`.
3. CLI gathers provider credentials and writes local/Vercel environment config.
4. CLI provisions or connects required services.
5. CLI runs database setup and bootstrap checks.
6. User opens the admin dashboard and visits `Settings -> Setup`.
7. The Setup tab confirms everything is healthy and provides next actions.

## Product Boundary

The setup flow should be split into two cooperating systems.

### 1. Local CLI

The CLI runs on the user's machine or CI environment where it can safely:

- create or update `.env.local`
- call provider CLIs/APIs
- run Prisma commands
- set Vercel environment variables
- configure Stripe webhook endpoints
- seed/bootstrap the store
- run local verification commands

### 2. In-App Setup Wizard

The admin Setup tab runs inside the deployed app and should not execute local shell commands.

It should:

- show setup status
- identify missing environment values
- verify database connectivity
- verify Stripe webhook configuration
- verify email provider configuration
- verify required secrets exist
- provide copy/paste CLI commands for the next step
- show completion status after the CLI has run

The app should not ask for broad provider tokens unless the storage, encryption, scope, and lifecycle are explicitly designed.

## Phase A - `doopify doctor`

Status: shipped first CLI slice

Purpose: create a read-only diagnostic command that can run safely before setup.

Checks:

- Node version
- package manager availability
- dependency install state
- `.env` / `.env.local` presence
- required environment variables
- Prisma client generation
- database reachability
- migration or schema sync status
- admin owner presence
- Stripe key presence
- webhook retry secret presence
- email provider key presence once email observability ships
- Vercel CLI availability when deployment checks are requested

Acceptance:

- `doopify doctor` prints pass/warn/fail results. — shipped
- It never writes files unless explicitly passed a repair flag later. — shipped
- It exits non-zero when required checks fail. — shipped
- The same status model can be reused by the in-app Setup tab. — shipped foundation (`src/server/services/setup.service.ts`)

## Phase B - Setup Status API And Admin Setup Tab

Status: shipped foundation (`/api/setup/status` + Settings -> Setup checklist tab)

Add:

```txt
src/server/services/setup.service.ts
src/app/api/setup/status/route.ts
src/components/settings/SetupPanel.js
```

Setup status should include:

- database
- admin owner
- auth/session secrets
- Stripe keys
- Stripe webhook secret
- webhook retry secret
- email provider config
- store settings
- Vercel deployment hints
- public app URL

The Setup tab should display checklist cards and a completion percentage, but `docs/STATUS.md` remains the canonical source of project status.

## Phase C - `doopify setup`

Status: planned after Setup status is reliable

Purpose: interactive setup command.

Prompts:

- store name
- owner email/password
- public app URL
- database provider choice
- Neon connection string or Neon provisioning token
- Stripe secret key
- Stripe publishable key
- Stripe webhook destination choice
- webhook retry secret generation/confirmation
- email provider choice and API key
- Vercel project link/deploy choice

Actions:

- write/update `.env.local`
- optionally set Vercel env vars
- run `npm install` when needed
- run `npm run db:generate`
- run `npm run db:push` or future migration command
- run `npm run db:seed:bootstrap`
- optionally configure Stripe webhook endpoint
- run `npm run test` and `npm run build` when requested

Safety:

- redact secrets in terminal output
- ask before overwriting existing env values
- support `--dry-run`
- support `--non-interactive` with env/input file later
- never commit generated secrets

## Phase D - One-Click Deploy Flow

Status: later, after CLI foundations are tested

Target user path:

1. Click Deploy to Vercel from README or docs.
2. Vercel creates the project from the repo.
3. User runs `npx doopify setup` locally or from a secure setup shell.
4. CLI provisions/connects Neon and sets Vercel env vars.
5. CLI configures Stripe webhook endpoint.
6. CLI runs Prisma setup/bootstrap.
7. User opens `/settings` and the Setup tab verifies completion.

## Initial CLI Shape

Recommended initial location:

```txt
scripts/doopify-cli.mjs
```

Recommended npm scripts:

```json
{
  "doopify:doctor": "node scripts/doopify-cli.mjs doctor",
  "doopify:setup": "node scripts/doopify-cli.mjs setup"
}
```

Once stable, extract to a package:

```txt
packages/create-doopify/
```

Future command names:

```bash
doopify doctor
doopify setup
doopify deploy
doopify env push
doopify stripe webhook
doopify db migrate
doopify seed owner
```

## Dependencies To Evaluate

Potential CLI libraries:

- `commander` or `cac` for command parsing
- `prompts` or `enquirer` for interactive prompts
- `kleur` or `picocolors` for terminal output
- provider CLIs/APIs for Vercel, Neon, and Stripe

Do not add these until the first CLI implementation begins.

## Acceptance For Setup/CLI Foundation

The setup foundation is complete when:

- `doopify doctor` can identify missing setup pieces locally.
- `Settings -> Setup` can show the same setup health inside the admin.
- `doopify setup` can generate/update local env, run database setup, and bootstrap the admin owner/store.
- Vercel/Neon/Stripe automation is either implemented or explicitly shown as manual next steps.
- Secrets are redacted in logs and never exposed through admin APIs.
- Tests cover setup status derivation and at least the non-mutating doctor checks.

## Relationship To Current Roadmap

This work should not interrupt Phase 4 correctness.

Recommended order:

1. Finish current Phase 4 correctness bugs.
2. Ship transactional email observability.
3. Add `doopify doctor` and Setup status API.
4. Add admin Setup tab.
5. Add interactive `doopify setup`.
6. Add Vercel/Neon/Stripe automation.

## Non-Goals For First Pass

- public plugin marketplace setup
- full multi-tenant provisioning
- storing broad Vercel/Neon account tokens inside the app
- replacing Vercel/Neon dashboards entirely
- running local shell commands from the browser
