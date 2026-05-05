# First-Owner Setup

Create the initial owner account for a fresh Doopify installation.

---

## How owner bootstrap works

The `/create-owner` page and `POST /api/bootstrap/owner` endpoint are open only when:

- No owner account exists in the database
- In production (`NODE_ENV=production`): `SETUP_TOKEN` must match

Once an owner exists, the bootstrap route returns `409 Conflict` and the page is no longer usable.

---

## Development

No `SETUP_TOKEN` required. Visit `http://localhost:3000/create-owner` and create the account.

---

## Production (Vercel or any host)

**Step 1 — Set SETUP_TOKEN before deploying**

Add `SETUP_TOKEN` as an environment variable in Vercel (or your host):

```
SETUP_TOKEN=some-random-32-char-token
```

**Step 2 — Visit the bootstrap page**

Open `https://<your-domain>/create-owner`.

Enter the store name, your email, your password, and paste the `SETUP_TOKEN` value.

**Step 3 — Revoke SETUP_TOKEN after creation**

Remove or change `SETUP_TOKEN` in Vercel environment variables and redeploy (or force-redeploy) so the token no longer works. This prevents replay attacks.

---

## Recovery: owner locked out or forgot password

Use the CLI recovery tool:

```bash
npm run doopify:reset-owner
```

This connects via `DATABASE_URL`, creates the first OWNER if none exists, or resets any existing OWNER's password. Revokes all active sessions. Does not log hashes or secrets.

For full recovery procedures, see [docs/ADMIN_USER_RECOVERY_GUIDE.md](../ADMIN_USER_RECOVERY_GUIDE.md).

---

## After owner creation

1. Log in at `/login`
2. Go to **Settings → Payments** and connect Stripe
3. Go to **Settings → Shipping & delivery** and configure rates
4. Create products in **Products**
5. Run a test checkout

See [docs/quickstart.md](../quickstart.md) for the full path.

---

## SETUP_TOKEN security notes

- `SETUP_TOKEN` only gates the bootstrap route. Once an owner exists it has no effect.
- Do not reuse `SETUP_TOKEN` as `JWT_SECRET`, `ENCRYPTION_KEY`, or `WEBHOOK_RETRY_SECRET`.
- Revoke it after first-owner creation.
