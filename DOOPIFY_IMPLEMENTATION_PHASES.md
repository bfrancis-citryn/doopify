# Doopify Implementation Phases

## 1. Upgrade Prisma schema
Done in this pass:
- Added real order system entities and enums
- Added addresses, fulfillments, refunds, returns, and order events
- Added store order sequencing support

## 2. Create commerce/order docs
Done in this pass:
- `DOOPIFY_COMMERCE_PLAN.md`
- `DOOPIFY_ORDER_SYSTEM_ARCHITECTURE.md`

## 3. Add DB query scaffold
Done in this pass:
- `src/lib/db/prisma.js`
- `src/lib/orders/getOrderByNumber.js`
- `src/lib/orders/listOrders.js`
- `src/lib/orders/mapDbOrderToViewModel.js`
- `src/lib/orders/queries.js`

## 4. Add bootstrap seed path
Done in this pass:
- `scripts/bootstrap-store.mjs`
- upgraded `.env.example`

## 5. Next integration steps
Next real implementation tasks:
1. Install Prisma/client/bcrypt/dotenv dependencies in the repo
2. Run `npx prisma generate`
3. Run `npx prisma db push`
4. Run `npm run db:seed:bootstrap`
5. Build `/orders` and `/orders/[orderNumber]` server-side DB reads
6. Replace local mock Orders context for admin order pages
7. Add Stripe checkout order creation flow
