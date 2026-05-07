# Shipping & Delivery Settings Reference

> Design/build reference for replacing the current shipping setup wizard with a compact, provider-first Shipping & delivery settings page.
>
> Created: May 1, 2026
> Status: design/build reference

## Intent

The current shipping setup experience is too wizard-like and does not clearly separate checkout shipping rates, label buying, packages, fallback rates, and manual fulfillment.

This page should be compact, merchant-friendly, and functional.

## Core Rule

```txt
Checkout rates decide what customers pay.
Label providers create postage after the order is placed.
Packages describe the physical container used for live rates and labels.
Fallback rates appear only when live carrier rates fail.
```

## Product Decision

Replace the current `Shipping Setup Wizard` direction with a `Shipping & delivery` settings page made of compact cards and action drawers.

Use this section structure:

1. Simple rule / explainer
2. Checkout rate method
3. Live rate and label provider
4. Live-rate requirements
5. Packages
6. Manual checkout rates
7. Live-rate fallback
8. Local options and documents

## Important UX Rule

Do not reuse the provider credential drawer for every shipping action.

Each action must open a drawer with fields that match the action:

| Action | Drawer content |
| --- | --- |
| Manage Shippo / EasyPost | Provider credentials, verify connection, provider usage |
| Set location | Ship-from address fields |
| Add/Edit package | Package dimensions and weight fields |
| Add fallback | One fallback rate used only if live rates fail |
| Add/Edit manual rate | Flat/free/weight/price-based checkout rate |
| Configure manual fulfillment | Fulfillment instructions and manual tracking behavior |
| Local delivery | ZIP/radius, price, minimum order, instructions |
| Pickup in store | Pickup location, instructions, pickup estimate |
| Packing slip | Logo, SKU visibility, footer note, preview |

## Main Page Copy

Title:

```txt
Shipping & delivery
```

Subtitle:

```txt
Choose what customers pay at checkout, how labels are created, and what happens if live rates fail.
```

Simple rule:

```txt
Checkout rates decide what customers pay. Label providers create postage after the order is placed.
```

Pills:

```txt
Checkout rates
Label buying
Fallbacks
```

## Checkout Rate Method

Main question:

```txt
Choose how customers are charged for shipping.
```

Options:

### Live carrier rates

```txt
Shippo/EasyPost returns carrier prices at checkout.
```

### Manual rates

```txt
Flat, free, weight-based, or price-based rates.
```

### Hybrid

```txt
Use live rates first, with manual fallback rates.
```

## Live Rate And Label Provider

Rows:

### Shippo

```txt
Live rates, labels, tracking, and validation.
```

Status examples:

```txt
Connected
Not connected
Verification failed
```

### EasyPost

```txt
Alternative rate and label provider.
```

### Manual fulfillment

```txt
Mark shipped and add tracking manually. No label buying.
```

## Live-Rate Requirements

Required when using Shippo/EasyPost for rates or labels:

### Ship-from location

```txt
Address used for quotes, labels, and returns.
```

### Packages

Instead of a single `Set package` row, show a real package list.

No packages state:

```txt
No packages yet.
Add a default package so live rates and label buying can estimate shipping correctly.
```

Package row examples:

```txt
Default box
10 × 8 × 4 in · 4 oz
Default
Edit

Poly mailer
12 × 15 in · 1 oz
Edit
```

### Live-rate fallback

```txt
Optional rate shown only if live rates fail.
```

## Manual Checkout Rates

Description:

```txt
Used in Manual mode, or as fallback in Hybrid mode.
```

Rows:

```txt
Standard flat rate
United States · $8.00 · 3–7 business days
Edit

Free shipping
United States · orders over $75
Edit

Heavy item shipping
United States · 20+ lb · $25.00
Edit
```

Footer note:

```txt
Manual rates control what customers pay. They do not buy postage.
```

## Local Options And Documents

Rows:

```txt
Local delivery
Offer delivery by ZIP code or radius.
Set up

Pickup in store
Let customers pick up from your location.
Set up

Packing slip
Logo, address, items, SKU, and footer note.
Edit
```

## Drawer Field Requirements

### Provider Drawer

Fields:

- Provider: Shippo / EasyPost
- API token
- Provider usage:
  - Live rates and label buying
  - Label buying only
  - Live rates only

Actions:

- Save credentials
- Verify connection
- Disconnect provider if connected

Rules:

- Store credentials encrypted.
- Saved secrets show as masked status only.
- Raw secrets must never render after save.

### Ship-From Location Drawer

Fields:

- Location name
- Contact name
- Company/name
- Address 1
- Address 2
- City
- State/province
- Postal code
- Country
- Phone
- Default location toggle if multiple locations are implemented

Actions:

- Validate address if provider supports it
- Save location

### Package Drawer

Fields:

- Package name
- Package type: Box / Poly mailer / Envelope / Custom
- Length
- Width
- Height
- Dimension unit: in / cm
- Empty package weight
- Weight unit: oz / lb / g / kg
- Default package toggle
- Active toggle

Rules:

- Add package opens empty drawer.
- Edit opens same drawer with saved values.
- Only one package can be default.
- Packages are required for live rates and label buying.
- Manual checkout rates can work without packages.

### Live-Rate Fallback Drawer

Fields:

- Fallback name
- Region
- Amount
- Estimated delivery text
- Active toggle

Rule:

- This rate appears only if Shippo/EasyPost cannot return live rates.
- This is not the same as a normal manual checkout rate.

### Manual Checkout Rate Drawer

Fields:

- Rate name
- Region/country/state
- Rate type: Flat / Free / Weight-based / Price-based
- Amount
- Min weight
- Max weight
- Min subtotal
- Max subtotal
- Free over
- Estimated delivery text
- Active toggle

Rule:

- Manual checkout rates are what customers can choose and pay for at checkout.
- Manual checkout rates do not buy postage.

### Manual Fulfillment Drawer

Fields:

- Default fulfillment instructions
- Manual tracking behavior if supported

Rule:

- Use this when labels are bought outside Doopify or tracking is added manually.

### Local Delivery Drawer

Fields:

- Enabled toggle
- Delivery price
- Minimum order
- ZIP codes or radius
- Delivery instructions

### Pickup Drawer

Fields:

- Enabled toggle
- Pickup location
- Pickup instructions
- Pickup estimate

### Packing Slip Drawer

Fields:

- Use store logo / no logo
- Show SKU
- Show product images if supported
- Footer note
- Preview

## Data Model Requirements

The implementation should not only update UI. Persist the data needed by checkout and order fulfillment.

### Shipping Settings

Persist:

```txt
shippingMode: LIVE_RATES / MANUAL / HYBRID
activeRateProvider: SHIPPO / EASYPOST / NONE
labelProvider: SHIPPO / EASYPOST / NONE
fallbackBehavior: SHOW_FALLBACK / HIDE_SHIPPING / MANUAL_QUOTE
```

### Packages

Create or reuse persisted package storage:

```txt
id
name
type: BOX / POLY_MAILER / ENVELOPE / CUSTOM
length
width
height
dimensionUnit: IN / CM
emptyPackageWeight
weightUnit: OZ / LB / G / KG
isDefault
isActive
createdAt
updatedAt
```

### Ship-From Locations

Create or reuse persisted location storage:

```txt
id
name
contactName
company
address1
address2
city
state/province
postalCode
country
phone
isDefault
isActive
createdAt
updatedAt
```

### Manual Checkout Rates

Create or reuse persisted manual rate storage:

```txt
id
name
region/country/state
rateType: FLAT / FREE / WEIGHT_BASED / PRICE_BASED
amount
minWeight
maxWeight
minSubtotal
maxSubtotal
freeOverAmount
estimatedDeliveryText
isActive
createdAt
updatedAt
```

### Live-Rate Fallback

Store separately from normal manual checkout rates:

```txt
id
name
region
amount
estimatedDeliveryText
isActive
createdAt
updatedAt
```

## Checkout Behavior

### LIVE_RATES

1. Require active provider, default ship-from location, and default active package.
2. Request live rates from provider.
3. If provider returns rates, show live rates.
4. If provider fails and fallback exists, show fallback rate.
5. If no fallback exists, return a clear checkout error.

### MANUAL

1. Ignore live provider.
2. Match manual checkout rates based on destination/cart.
3. Return eligible manual rates.
4. Do not require package dimensions.

### HYBRID

1. Try live provider.
2. Include configured manual rates if product decision supports it.
3. If live provider fails, use fallback/manual rates.

## Order Behavior

When customer selects shipping, store:

```txt
shippingMethodName
shippingRateType
shippingAmount
shippingProvider
providerRateId if live rate
estimatedDeliveryText
```

Do not assume a shipping label exists just because shipping was charged.

Order detail behavior:

- If label provider is connected, show Buy label.
- If no label provider is connected, show Mark fulfilled / Add tracking manually.
- If customer chose a manual checkout rate but Shippo/EasyPost is connected for labels, still allow Buy label.

## Style Guidance

Use existing Doopify settings/admin components and CSS module patterns. Do not create a separate design system.

The attached standalone HTML mock is for structure, density, drawer mapping, and copy direction only.

Keep the page compact:

- Section titles around 14px–15px
- Row text around 12px–13px
- Badge text around 11px
- Row padding around 12px–15px
- Drawer card padding around 13px
- Keep text off card edges
- Keep visible copy short
- Put detailed setup fields in drawers

## Acceptance Criteria

- Current wizard UI is replaced or demoted behind a setup/help action.
- Main page follows provider-first compact card structure.
- Each action opens a correct drawer; provider API fields only appear in provider drawer.
- Packages are a real list with Add/Edit and default package behavior.
- Manual checkout rates are separate from live-rate fallback.
- Shipping settings are persisted and used by checkout.
- Manual rates work without Shippo/EasyPost.
- Live rates require provider, location, and package.
- Fallback is only used when live rates fail.
- Orders store the selected shipping method.
- Label buying is separated from the shipping charge.
- Raw provider secrets are never rendered after save.
