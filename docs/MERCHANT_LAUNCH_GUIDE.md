# Merchant Launch Guide

This guide walks a merchant through setting up Doopify from a fresh install to a private beta launch. Follow sections in order.

---

## 1. Install and setup overview

Doopify is a self-hosted Next.js commerce engine. You run it on your own infrastructure (locally, on Vercel, or any Node.js host).

Requirements:
- Node.js 20+
- PostgreSQL database (Neon, Supabase, Railway, or self-hosted)
- npm

```bash
git clone <your-doopify-repo>
cd doopify
npm install
```

After install, run `npm run doopify:doctor` to get a runtime diagnostics report.

---

## 2. Environment setup

Copy the template below into `.env.local` in the repo root and fill in each value.

```bash
# Database
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Admin auth
JWT_SECRET="generate-a-random-32-character-secret"

# Stripe payments
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Webhook retry protection
WEBHOOK_RETRY_SECRET="generate-a-random-16-character-secret"

# Email (optional for private beta)
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...

# Storefront
NEXT_PUBLIC_STORE_URL=https://your-storefront-domain.com
```

Generate secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Database setup

After setting `DATABASE_URL`:

```bash
npm run db:generate   # generates Prisma client
npm run db:push       # applies schema to database
npm run db:seed:bootstrap  # creates initial store and owner records
```

Verify the database is reachable:
```bash
npm run doopify:db:check
```

---

## 4. Stripe setup

1. Create a Stripe account at stripe.com.
2. Copy the publishable key and secret key from the Stripe dashboard.
3. Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.local`.
4. Configure the Stripe webhook endpoint:

```bash
npm run doopify:stripe:webhook
```

This registers `/api/webhooks/stripe` and outputs the webhook signing secret. Set it as `STRIPE_WEBHOOK_SECRET`.

5. In the admin, go to **Settings → Payments**, open the Stripe drawer, save credentials, and click **Verify provider**.

---

## 5. Shipping setup

Go to **Settings → Shipping & delivery** in the admin.

Choose a shipping mode:

- **Manual**: Set flat rates for domestic and international shipping. Requires at least one active manual rate before launch.
- **Live rates** (via Shippo or EasyPost): Connects to a live shipping provider for real-time rates. Requires an origin address, default package dimensions, and a connected provider.
- **Hybrid**: Uses live rates when available and falls back to manual rates.

At minimum for private beta, configure manual flat rates so orders can be placed.

The **Launch readiness** panel in **Settings → Setup** shows whether shipping is ready.

---

## 6. Tax setup

Go to **Settings → Taxes & duties** in the admin.

Options:
- **Disable tax collection**: Set `taxEnabled` to false. The launch readiness panel shows "Skipped" — this does not block launch.
- **Enable manual tax**: Set a default tax rate in basis points (e.g., 875 = 8.75%). Applies to all orders.

If you leave tax enabled but set no rate, the launch readiness panel shows "Needs setup" and will block the readiness score.

For private beta, disabling tax collection is a valid approach if tax compliance is not yet required.

---

## 7. Product setup

Go to **Products** in the admin.

Before launch:
1. Create at least one product.
2. Set the product status to **Active**.
3. Ensure at least one variant has a price greater than zero.
4. Ensure at least one variant has inventory greater than zero.
5. (Optional) Add product images. Media improves conversion but does not block launch.

The **Launch readiness** panel reports on active product count, pricing, and inventory separately.

---

## 8. Media and object storage

Product images are stored as assets. By default, media upload uses the local filesystem or an object storage provider depending on your configuration.

For production:
- Configure object storage (S3-compatible) via environment variables if your host does not persist local files.
- All media is served through `/api/media/:id` — the URL is stable.

Missing product media shows as **Optional** in the launch readiness panel and does not block launch.

---

## 9. Email provider

Go to **Settings → Email** in the admin and connect Resend.

Transactional emails include order confirmations, shipping notifications, and refund notices.

Email is **optional for private beta**. If no provider is configured, the system operates in preview mode (no live sends). The launch readiness panel marks email as **Optional**, not a blocker.

To enable:
1. Create a Resend account at resend.com.
2. Add your API key to **Settings → Email → Connect Resend**.
3. (Recommended) Configure the webhook secret for bounce and complaint handling.

---

## 10. Webhook and job runner

Doopify uses background webhook delivery and retry logic.

Set `WEBHOOK_RETRY_SECRET` to protect retry routes. Without it, the launch readiness panel marks the check as **Optional** — this is safe for private beta but should be set before public launch.

To monitor webhook delivery:
- Go to **System → Delivery logs** in the admin.
- Inspect failed deliveries, retry counts, and provider responses.

---

## 11. Test checkout walkthrough

Before launch, complete a full test order:

1. Open the storefront at `NEXT_PUBLIC_STORE_URL`.
2. Add a product to cart.
3. Proceed to checkout.
4. Use a Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC.
5. Complete the order.
6. Verify the order appears in **Orders** in the admin.
7. Verify (if email is configured) that a confirmation email was sent.
8. Test a refund from the order detail page.

---

## 12. Private beta launch checklist

Use the **Launch readiness** panel in **Settings → Setup** for the live server-derived checklist. Below is the manual equivalent:

- [ ] Store name and contact email are set in Settings → General
- [ ] Stripe keys are configured and verified in Settings → Payments
- [ ] STRIPE_WEBHOOK_SECRET is set and the webhook endpoint is registered
- [ ] At least one shipping method is ready (manual or live)
- [ ] Tax is configured or intentionally disabled
- [ ] At least one active product exists with a valid price and available inventory
- [ ] NEXT_PUBLIC_STORE_URL is set to the live storefront URL
- [ ] Owner login works in the admin
- [ ] A test order completes successfully end-to-end
- [ ] WEBHOOK_RETRY_SECRET is set (recommended before public launch)
- [ ] Email provider is configured (optional for private beta)
