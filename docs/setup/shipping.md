# Shipping Setup

Configure shipping rates so customers can complete checkout.

Shipping is required for any physical product order. At least one active shipping method must exist before checkout can complete.

---

## Shipping modes

Go to **Settings → Shipping & delivery** in the admin to configure.

### Manual rates (recommended for private beta)

Define flat, per-item, weight-based, or free-over-amount rates for specific destinations or globally.

Setup:
1. Set mode to **Manual rates**.
2. Click **Add rate**.
3. Set rate type, amount, destination (country or leave blank for all), and mark it active.
4. Save.

At checkout, the customer's address is matched against active manual rates. At least one rate must match or checkout shows no shipping options.

**Minimum for launch:** One active flat-rate for your primary destination.

### Live rates (Shippo or EasyPost)

Get real-time carrier rates at checkout.

Prerequisites:
- Provider API key saved and verified in Settings → Shipping & delivery
- Ship-from address configured
- Default package dimensions and weight configured

Setup:
1. Set mode to **Live carrier rates**.
2. Connect a provider: open the provider drawer and save credentials.
3. Click **Test provider** to verify connectivity.
4. Configure ship-from location and default package.

### Hybrid mode

Tries live rates first. Falls back to manual rates if the live provider returns no results or errors.

---

## Shipping zones and tax rules

Manual rates can be scoped to shipping zones (groups of countries/regions). Tax rules can be jurisdiction-scoped by country/region/postal prefix.

Configure at **Settings → Taxes & duties**.

---

## Label purchasing (Shippo / EasyPost)

After creating a manual fulfillment, you can purchase a shipping label directly from the order detail page.

Prerequisites:
- Provider is connected and verified
- Ship-from address is configured
- Default package dimensions are set

Labels are stored in the `ShippingLabel` table and linked to fulfillments.

---

## Troubleshooting: no shipping options at checkout

1. Confirm at least one manual rate exists and is marked active.
2. Check the rate's destination country — if set, the customer's country must match.
3. For weight-based rates, all cart items need a weight value on the variant.
4. Use the **Test rates** button in shipping settings to diagnose mismatches.
5. See [docs/troubleshooting.md](../troubleshooting.md) for more.

---

## Setup status

The **Launch readiness** panel in **Settings → Setup** reports whether shipping is configured correctly before launch.
