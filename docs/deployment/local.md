# Local Development Setup

Run Doopify locally against a real Postgres database.

---

## Prerequisites

- Node.js 20+
- PostgreSQL database (local or cloud — Neon free tier works)
- npm

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Configure environment

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/doopify_dev"
DIRECT_URL="postgresql://user:password@localhost:5432/doopify_dev"
JWT_SECRET="your-random-32-char-secret"
ENCRYPTION_KEY="your-random-32-char-secret"
NEXT_PUBLIC_STORE_URL="http://localhost:3000"
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
WEBHOOK_RETRY_SECRET="your-random-16-char-secret"
```

Generate random secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Bootstrap the database

```bash
npm run db:generate      # generate Prisma client
npm run db:push          # apply schema
npm run db:seed:bootstrap  # create initial store record
```

---

## 4. Run diagnostics

```bash
npm run doopify:doctor
```

This checks database connectivity, env var presence, and schema health.

---

## 5. Start the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## 6. Create the owner account

Visit `http://localhost:3000/create-owner`.

In development (`NODE_ENV` not `production`), no `SETUP_TOKEN` is required.

---

## Local Stripe webhook testing

Use the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks to your local server:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the output webhook signing secret and set it as `STRIPE_WEBHOOK_SECRET` in `.env`.

---

## Verification gate

Before committing or opening a PR:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

Run integration tests when a disposable test database is configured:

```bash
DATABASE_URL_TEST="postgresql://..." npm run test:integration
```

Never point `DATABASE_URL_TEST` at your development or production database.

---

## Explore the database

```bash
npm run db:studio
```

Opens Prisma Studio at `http://localhost:5555`.
