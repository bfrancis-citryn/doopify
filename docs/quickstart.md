# Doopify Quickstart

Get a working store running in under 15 minutes.

---

## Prerequisites

- Node.js 20+
- PostgreSQL database (Neon recommended, free tier works)
- Stripe account (test mode)
- npm

---

## 1. Clone and install

```bash
git clone <your-doopify-repo>
cd doopify
npm install
```

---

## 2. Set environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the required values:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your Postgres connection string |
| `DIRECT_URL` | Same as `DATABASE_URL` for most setups |
| `JWT_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENCRYPTION_KEY` | Same command as above |
| `NEXT_PUBLIC_STORE_URL` | `http://localhost:3000` for local dev |
| `STRIPE_SECRET_KEY` | Stripe Dashboard -> Developers -> API Keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same page, publishable key |
| `STRIPE_WEBHOOK_SECRET` | Set after step 5 |
| `WEBHOOK_RETRY_SECRET` | Any random 32-char string |

`DATABASE_URL` and `DIRECT_URL` must be configured before the app can boot.

---

## 3. Set up the database

```bash
npm run db:generate
npm run db:push
npm run db:seed:bootstrap
```

Verify the connection:

```bash
npm run doopify:doctor
```

---

## 4. Create the owner account

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000/create-owner` and create the first admin account.

`SETUP_TOKEN` behavior:
- Local development: optional.
- Production: required.
- `/create-owner` requires a token only when `SETUP_TOKEN` is set.
- After the first active owner exists, `/create-owner` closes permanently.

See [docs/setup/first-owner.md](./setup/first-owner.md).

---

## 5. Configure Stripe

In the admin, go to **Settings -> Payments**, open the Stripe drawer, and save your API keys.

Then register the webhook endpoint:

```bash
npm run doopify:stripe:webhook
```

Copy the output `STRIPE_WEBHOOK_SECRET` into `.env.local` and restart the server.

---

## 6. Configure shipping

Go to **Settings -> Shipping & delivery** in the admin.

For a quick setup, choose **Manual rates** and add a flat rate for your target destination.

See [docs/setup/shipping.md](./setup/shipping.md) for full options.

---

## 7. Create a product

Go to **Products** in the admin and create at least one product:

- Set status to **Active**
- Set a price > 0
- Set inventory > 0

---

## 8. Run a test checkout

1. Open the storefront at `http://localhost:3000`
2. Add a product to cart
3. Proceed to checkout
4. Fill in contact and address
5. Select a shipping option
6. Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC
7. Complete the order
8. Verify the order appears in **Orders** in the admin

---

## 9. Optional next steps

- Configure email in **Settings -> Email**
- Invite team members in **Settings -> Team**
- Enable MFA in **Settings -> My account**

---

## What's next

- Deploy to Vercel: [docs/deployment/vercel.md](./deployment/vercel.md)
- Invite team members: [docs/setup/team.md](./setup/team.md)
- Configure email: [docs/setup/email.md](./setup/email.md)
- Run the pilot validation runbook: [docs/operations/pilot-validation-runbook.md](./operations/pilot-validation-runbook.md)
