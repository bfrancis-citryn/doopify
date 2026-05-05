# Doopify Pilot Smoke Checklist

> Use this checklist before handing off to a pilot merchant or declaring the deployment smoke-tested.
>
> Created: Phase 20 — Pilot Polish And Setup UX
> Production URL: https://doopify.vercel.app

---

## Pre-Checklist: Environment Requirements

Before running any smoke test, confirm these are in place:

- [ ] `DATABASE_URL` points to a live Neon Postgres database
- [ ] `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` are set (test mode for pilot)
- [ ] `STRIPE_WEBHOOK_SECRET` matches the endpoint secret from the Stripe dashboard
- [ ] Stripe webhook endpoint registered: `https://<your-domain>/api/webhooks/stripe`
- [ ] Webhook listens for: `payment_intent.succeeded`, `payment_intent.payment_failed`
- [ ] `NEXTAUTH_SECRET` (or `JWT_SECRET`) is set and matches across deployments
- [ ] `ADMIN_EMAIL` and `ADMIN_PASSWORD` are configured for the owner account
- [ ] `NODE_ENV=production` on Vercel

---

## 1. Admin Auth

- [ ] Navigate to `/login` — login form loads
- [ ] Log in with admin credentials — redirected to `/admin` dashboard
- [ ] Log out — session is destroyed, redirect to `/login`
- [ ] Attempting to access `/admin` without a session redirects to `/login`

---

## 2. Product Setup

- [ ] Create at least one product in `/admin/products`
  - [ ] Product has a title, price, and at least one variant
  - [ ] Product has inventory > 0
  - [ ] Product status is set to **Active**
  - [ ] *(For weight-based shipping)* Variant has a weight value set (e.g., 12 oz)
- [ ] Product appears on the storefront at `/shop`
- [ ] Product detail page at `/shop/[handle]` loads correctly
- [ ] "Add to cart" works — item appears in cart

---

## 3. Shipping Configuration

Pick one of the following checkout rate modes and verify it works end-to-end:

### Option A — Manual flat rate (simplest, recommended for pilot)

- [ ] Go to `/admin/settings/shipping`
- [ ] Set mode to **Manual rates**
- [ ] Add a manual checkout rate:
  - Rate type: **Flat**
  - Destination country: `US` (or leave blank for all)
  - Amount: e.g., `$8.00`
  - Mark active
- [ ] Save
- [ ] At checkout, after entering a US address, click **Load shipping options** — the flat rate appears

### Option B — Weight-based rate

- [ ] Ensure all variants in the cart have a weight set (e.g., 12 oz)
- [ ] Add a manual rate with type **Weight-based**
- [ ] Set min weight to `0` oz so unweighted products still match
- [ ] At checkout, the rate appears when address is entered

### Option C — Live rates (Shippo / EasyPost)

- [ ] Provider credentials are saved and verified in Shipping settings
- [ ] Ship-from location is configured with a valid address
- [ ] Default package dimensions and weight are set
- [ ] Mode is set to **Live carrier rates** or **Hybrid**
- [ ] At checkout, live rates appear after entering address

---

## 4. Checkout Flow

- [ ] Add item(s) to cart from `/shop`
- [ ] Navigate to `/checkout`
- [ ] Fill in contact email, shipping address
- [ ] Click **Load shipping options** — rates appear
- [ ] Select a shipping option
- [ ] Click **Review payment** — Stripe payment element loads
- [ ] Enter Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC
- [ ] Click **Place order**
- [ ] Browser redirects to `/checkout/success`
- [ ] Success page shows order number (e.g., `Order #1001`)

---

## 5. Webhook And Order Verification

This is the core trust path. Confirm the order was created by the webhook, not the redirect.

- [ ] In the Stripe dashboard → Webhooks → check the endpoint received `payment_intent.succeeded` with status 200
- [ ] In `/admin/webhooks` (Delivery logs) — the inbound Stripe webhook delivery shows `PROCESSED`
- [ ] In `/admin/orders` — the order appears with the correct line items, shipping, and total
- [ ] Order status is **Paid** (not pending)
- [ ] Inventory on the purchased variant decreased by the ordered quantity

---

## 6. Inventory Check

- [ ] Before checkout: note the variant inventory count in `/admin/products`
- [ ] Complete a checkout for quantity 1
- [ ] After checkout: verify inventory decreased by 1
- [ ] Attempt to purchase more than the available inventory — checkout should reject with a stock error

---

## 7. Order Admin

- [ ] Navigate to the order in `/admin/orders/[orderNumber]`
- [ ] Order detail shows: customer email, items, shipping address, payment status
- [ ] Shipping amount and tax amount are visible
- [ ] Order notes section is present (can be used for internal notes)

---

## 8. Discount Codes (if configured)

- [ ] Create a discount code in `/admin/discounts`
  - e.g., `PILOT10` — 10% off — usage limit 5
- [ ] At checkout, click **+ Add promo code**, enter `PILOT10`
- [ ] Click **Review payment** — discount is reflected in the total
- [ ] After order completion, verify the discount usage count incremented in admin

---

## 9. Email Delivery (if Resend is configured)

- [ ] `RESEND_API_KEY` is set and sender identity is verified
- [ ] After a successful checkout, an order confirmation email is sent to the customer email
- [ ] In `/admin/webhooks` → Email tab, the delivery record shows `SENT`
- [ ] If a delivery shows `FAILED`, use the **Resend** button to retry without creating a duplicate order

---

## 10. Setup Status Panel

- [ ] Navigate to `/admin/settings` → **Setup** tab
- [ ] Review checklist items — all required items should show green
- [ ] Any warnings or missing items should be actionable (Stripe, database, env vars)

---

## 11. Edge Cases

- [ ] Empty cart → clicking checkout shows "Your cart is empty"
- [ ] Attempting checkout without selecting a shipping option → error message appears
- [ ] Stripe test card `4000 0000 0000 9995` (insufficient funds) → payment fails with clear error message, no order created
- [ ] Failed checkout state: navigate back to `/checkout` — form is still usable

---

## 12. Regression Check

After completing the checklist, verify nothing regressed:

- [ ] Admin login still works
- [ ] Products page loads
- [ ] Storefront shop page loads
- [ ] Cart still works after a completed checkout (cart is cleared)

---

## Pilot Sign-Off

| Check | Result | Notes |
|---|---|---|
| Stripe webhook → 200 OK | | |
| Order created by webhook (not redirect) | | |
| Inventory decremented correctly | | |
| Order visible in admin | | |
| Email delivered (if configured) | | |
| No console errors in production | | |

**Signed off by:** _______________  
**Date:** _______________  
**Production URL:** _______________
