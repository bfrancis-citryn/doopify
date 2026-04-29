# Contributing To Doopify

> Development rules for a developer-first, self-hostable commerce engine.
>
> Documentation refresh: April 26, 2026

## Start Here

Before changing code, read:

1. `STATUS.md`
2. `PROJECT_INTENT.md`
3. `features-roadmap.md`
4. `HARDENING.md`

Do not rely on deleted AI-agent notes, old `CLAUDE.md` content, or legacy `skill.md` content for current product status.

## Core Development Rules

### Use The Existing Architecture

Prefer extending current services, route handlers, DTOs, and Prisma models over creating parallel implementations.

Do not:

- bypass Prisma for core domain writes
- build fake state that competes with the database
- duplicate checkout, webhook, or collection foundations
- replace the handcrafted admin with generated CRUD
- add runtime plugin loading
- introduce new frameworks without a clear reason

### Keep Layers Clean

UI components:

- render state
- call route handlers or server-backed actions
- avoid embedding business logic
- never own payment truth

Route handlers:

- parse requests
- validate input
- authenticate/authorize
- call service modules
- return consistent responses

Services:

- own business logic
- call Prisma
- enforce commerce invariants
- emit typed events when useful

Prisma/Postgres:

- own persistent domain truth
- define relations, indexes, and uniqueness
- protect idempotency when possible

### Keep Checkout Server-Owned

Never trust the browser for:

- product price
- discount amount
- shipping amount
- tax amount
- total
- inventory availability
- payment success

The browser can initiate checkout. The server and Stripe webhook finalize the commerce state.

### Protect Public Data

Storefront responses should use public DTOs.

Do not expose:

- private admin fields
- raw Prisma payloads when a DTO is expected
- session data
- unpublished merchant data
- internal integration settings
- payment secrets

### Preserve Typed Extension Seams

Use the typed event system for internal integration behavior.

Do not introduce:

- dynamic filesystem plugin loading
- arbitrary `require()` plugin execution
- public plugin marketplace assumptions
- unstable unversioned third-party contracts

## Response Format

Keep API responses consistent.

Success:

```json
{
  "success": true,
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "error": "Message"
}
```

Rules:

- never expose raw server errors to clients
- use clear user-safe error messages
- log enough internal context to debug failures
- keep response shapes stable

## Money Rules

- Store money in integer minor units.
- Do not use floating point math for persisted currency totals.
- Recompute totals on the server.
- Add discounts, shipping, and tax through a central pricing path.
- Persist snapshots for order history where product data can change later.
- For USD this means `*Cents` fields at rest and Stripe `amount` values sent directly from those stored cents.
- Convert dollar inputs to cents at route/schema boundaries; do not let service/domain logic receive dollar floats.

## Inventory Rules

- Validate inventory before creating checkout sessions.
- Decrement inventory only after verified payment success.
- Use idempotency to avoid double-decrement on duplicate webhooks.
- Add race-condition coverage before launch claims.
- Never let stock go negative.

## Collection Rules

- Admin collection mutations must stay private.
- Storefront collection reads must stay public and read-only.
- List views should use summary payloads.
- Detail views may load nested product data.
- Collection publish/unpublish semantics are shipped and storefront reads must continue to exclude unpublished collections.
- Revalidate targeted storefront paths instead of broadly refreshing everything.

## Testing Priorities

Add automated coverage in this order:

1. checkout creation success
2. checkout validation failures
3. invalid webhook signature rejection
4. duplicate webhook delivery idempotency
5. inventory exhaustion and race conditions
6. discount/shipping/tax pricing behavior as those features land
7. collection assignment behavior
8. storefront collection visibility and DTO safety
9. admin-only collection mutations

Revenue-path, checkout, webhook, inventory, and discount-usage changes should include real-DB coverage when transaction behavior matters. Integration tests must use `DATABASE_URL_TEST` pointed at a disposable Postgres database or schema, never the normal development database.

## Recommended Verification

Run before merging meaningful work:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run test:integration # for checkout, webhook, inventory, discount, or revenue-path changes
npm run build
```

If tests are not installed yet, add them as part of the revenue-path hardening work rather than treating the absence of tests as acceptable.

## Definition Of Done

A feature is done when:

- it works end-to-end from DB to API/service to UI
- it survives refresh and navigation
- it handles validation failures cleanly
- it does not expose private data publicly
- it respects server-owned checkout and payment invariants
- it uses Prisma as the source of truth
- it emits typed events when integration behavior is needed
- it has automated coverage if it touches checkout, webhook, inventory, auth, or public DTO boundaries
- build and typecheck pass
- docs/status are updated if behavior or roadmap status changed

## Documentation Rule

When a feature changes status:

- update `STATUS.md`
- update `features-roadmap.md` if it affects product sequencing
- update `HARDENING.md` if it affects security, correctness, or operational readiness
- update `README.md` only when onboarding, routes, or headline status change

Do not create a new root-level status file.
