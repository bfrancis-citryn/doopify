# Doopify Next Phase

## Current state
### Completed
- Orders UI moved to route-based detail pages.
- Initial Shopify-style layout passes were pushed.
- Order system architecture was documented.
- Prisma schema was upgraded for a real commerce order system.
- Prisma Client generation now works in this repo.
- Local `.env` was created from `.env.example`.

### Current blocker
`prisma db push` is failing because PostgreSQL is not reachable at:
- `localhost:5432`

Error seen:
- `P1001: Can't reach database server at localhost:5432`

That means schema + seed scaffolding are ready, but the actual database instance is not available yet in this environment.

## Immediate next phase
### Phase: Infrastructure + DB-backed Orders
1. Bring up a PostgreSQL database reachable from the app.
2. Confirm/update `DATABASE_URL`.
3. Run:
   - `npm run db:generate`
   - `npm run db:push`
   - `npm run db:seed:bootstrap`
4. Wire `/orders` to `src/lib/orders/queries.js`.
5. Wire `/orders/[orderNumber]` to DB-backed order detail queries.
6. Replace mock Orders context for admin order routes.

## Follow-on phase
### Phase: Storefront commerce integration
1. Publishable product query layer
2. Product detail route contract
3. Cart contract
4. Checkout creation flow
5. Stripe payment intent flow
6. Order creation from storefront
7. Inventory reduction + order event creation

## Practical recommendation
Do not keep over-polishing the Orders UI against mock data. The next highest-value move is making Orders read from the new persistence model as soon as Postgres is available.
