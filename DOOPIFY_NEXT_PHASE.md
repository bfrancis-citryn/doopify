# Doopify Next Phase

## What Just Landed

- Prisma/Postgres is active as the main persistence layer.
- Admin auth is real and private routes are protected through `src/proxy.ts`.
- Product CRUD, product variants, options, media linking, and storefront publishing are working.
- Storefront product listing and product detail pages read real data.
- The admin shell has been redesigned into the Obsidian glass system.
- Media now has a standalone admin workspace at `/media` with upload, browse, alt text editing, and delete support.

## Immediate Next Phase

### Phase: Checkout And Order Creation

The next highest-value milestone is a real customer purchase path.

### Goals

1. Build a real `/checkout` experience.
2. Create Stripe PaymentIntents from the current cart.
3. Create orders from a Stripe webhook, not the browser redirect.
4. Decrement inventory safely when payment succeeds.
5. Trigger order confirmation email after successful payment.

### Why This Is Next

The catalog and admin are now connected enough that the missing value is no longer "save a product." The missing value is "buy a product."

Until checkout exists:

- storefront traffic cannot convert
- order creation is mostly admin-seeded/admin-managed
- payments are not real
- post-purchase automation cannot be finished

## Secondary Next Phase

### Phase: Operations Hardening

Once checkout is live, the next follow-up should be:

1. Persist draft orders in the database.
2. Add collection management and storefront collection routes.
3. Add role-based permissions and login rate limiting.
4. Add transactional email and customer account views.

## Current Blockers

These are the biggest functional gaps still open:

- no Stripe integration
- no checkout route
- no webhook pipeline
- no customer account area
- no DB-backed draft order conversion flow
- no collection CRUD and collection storefront pages

## Practical Recommendation

Do not spend the next pass polishing static storefront details or adding more admin chrome first.

The best next move is:

1. connect cart to checkout
2. connect checkout to Stripe
3. connect Stripe success to order creation
4. connect order creation to email and inventory updates

That gives Doopify its first real end-to-end commerce transaction.
