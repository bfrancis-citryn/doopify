# Payments Settings Drawer Reference

> Visual reference for rebuilding `Settings -> Payments` as a compact provider list with slide-over setup drawers.
>
> Created: April 30, 2026
> Status: design/build reference

## Intent

The current Payments settings UI is too large and form-heavy. Secret inputs are visible directly on the page, which makes the tab feel clunky and technical.

The new UI should be:

- compact
- list-based
- easy for store owners to scan
- honest about what is active vs. pending
- safe with credentials
- consistent with existing Doopify global styles and shared components

Use this reference as information architecture and layout guidance. Do **not** create an isolated one-off visual system. Use existing Doopify CSS modules, tokens, buttons, badges, cards, drawers, inputs, and shared setting components where possible.

## UX Direction

Payments should have three visible sections:

1. **Payment providers** — Stripe, PayPal, Manual payments.
2. **Customer checkout methods** — Cards, Apple Pay, Google Pay, Link, Cash App Pay, PayPal, Manual invoice.
3. **Payment activity** — payment/refund/provider event log.

Provider credential forms should not be permanently visible. They should open in a slide-over drawer when the user clicks **Manage**.

## Main Page Layout Reference

```html
<section class="settingsPanel paymentsSettings">
  <header class="settingsPageHeader">
    <div>
      <p class="settingsEyebrow">Settings</p>
      <h1>Payments</h1>
      <p>Manage processors, checkout methods, and payment activity without exposing private credentials on the main page.</p>
    </div>

    <div class="settingsHeaderActions">
      <span class="settingsPill">Business location: United States</span>
      <span class="settingsPill success">Test mode</span>
    </div>
  </header>

  <section class="settingsCard providerListCard">
    <header class="settingsCardHeader">
      <div>
        <h2>Payment providers</h2>
        <p>Connect payment gateways and manage which providers can process customer payments.</p>
      </div>
    </header>

    <div class="providerList">
      <article class="providerRow">
        <div class="providerIcon providerIconStripe">S</div>
        <div class="providerMain">
          <div class="providerTitleLine">
            <h3>Stripe</h3>
            <span class="statusBadge warning">Env keys found</span>
            <span class="statusBadge neutral">Official</span>
          </div>
          <p>Accept cards and eligible Stripe wallet methods like Apple Pay, Google Pay, Link, and Cash App Pay.</p>
          <p class="providerMeta">Checkout active source: <strong>not configured</strong></p>
          <div class="methodChips">
            <span>Cards</span>
            <span>Apple Pay</span>
            <span>Google Pay</span>
            <span>Link</span>
            <span>Cash App</span>
          </div>
        </div>
        <div class="providerActions">
          <button type="button" class="buttonPrimary">Manage</button>
          <button type="button" class="iconButton" aria-label="More Stripe actions">...</button>
        </div>
      </article>

      <article class="providerRow">
        <div class="providerIcon providerIconPayPal">P</div>
        <div class="providerMain">
          <div class="providerTitleLine">
            <h3>PayPal</h3>
            <span class="statusBadge warning">Setup needed</span>
            <span class="statusBadge neutral">Official</span>
          </div>
          <p>Let customers pay with PayPal, Pay Later, and Venmo where eligible.</p>
          <p class="providerMeta">Runtime support must be implemented before this can appear at checkout.</p>
          <div class="methodChips">
            <span>PayPal</span>
            <span>Pay Later</span>
            <span>Venmo</span>
          </div>
        </div>
        <div class="providerActions">
          <button type="button" class="buttonPrimary">Manage</button>
          <button type="button" class="iconButton" aria-label="More PayPal actions">...</button>
        </div>
      </article>

      <article class="providerRow">
        <div class="providerIcon providerIconManual">M</div>
        <div class="providerMain">
          <div class="providerTitleLine">
            <h3>Manual payments</h3>
            <span class="statusBadge neutral">Built-in</span>
          </div>
          <p>Accept offline payments for draft orders, invoices, phone orders, cash, or bank transfer workflows.</p>
          <div class="methodChips">
            <span>Cash</span>
            <span>Bank transfer</span>
            <span>Invoice</span>
          </div>
        </div>
        <div class="providerActions">
          <button type="button" class="buttonPrimary">Manage</button>
          <button type="button" class="iconButton" aria-label="More manual payment actions">...</button>
        </div>
      </article>
    </div>
  </section>

  <section class="settingsCard checkoutMethodsCard">
    <header class="settingsCardHeader">
      <div>
        <h2>Customer checkout methods</h2>
        <p>These are the payment options customers can see during checkout.</p>
      </div>
    </header>

    <div class="methodGrid compact">
      <article class="methodCard"><h3>Credit & debit cards</h3><span class="statusBadge warning">Needs Stripe</span><p>Available once Stripe is verified and checkout has an active runtime source.</p></article>
      <article class="methodCard"><h3>Apple Pay</h3><span class="statusBadge neutral">Requires domain</span><p>Requires Stripe, HTTPS, and payment domain verification.</p></article>
      <article class="methodCard"><h3>Google Pay</h3><span class="statusBadge neutral">Through Stripe</span><p>Available through Stripe when eligible.</p></article>
      <article class="methodCard"><h3>PayPal</h3><span class="statusBadge warning">Needs setup</span><p>Appears at checkout once PayPal runtime support is active.</p></article>
      <article class="methodCard"><h3>Cash App Pay</h3><span class="statusBadge neutral">Requires live mode</span><p>Requires eligible Stripe account, country, and live-mode configuration.</p></article>
      <article class="methodCard"><h3>Manual invoice</h3><span class="statusBadge neutral">Draft orders</span><p>Useful for quotes, phone sales, and offline collection.</p></article>
    </div>
  </section>

  <section class="settingsCard paymentActivityCard">
    <header class="settingsCardHeader">
      <div>
        <h2>Payment activity</h2>
        <p>Track order payments, failed payments, refunds, and provider references.</p>
      </div>
    </header>

    <table class="settingsTable compact">
      <thead>
        <tr><th>Date</th><th>Order</th><th>Provider</th><th>Event</th><th>Status</th><th>Amount</th><th>Reference</th></tr>
      </thead>
      <tbody>
        <tr><td>Apr 30, 2026</td><td>#DPY0001</td><td>Stripe</td><td>Payment intent created</td><td>Pending</td><td>$999.00</td><td>pi_••••••••</td></tr>
      </tbody>
    </table>
  </section>
</section>
```

## Slide-Over Drawer Reference

Use an existing drawer/slide-over component if one exists. Do not build an isolated modal system if the repo already has one.

```html
<aside class="settingsDrawer" aria-label="Stripe payment provider setup">
  <header class="drawerHeader">
    <div>
      <p class="settingsEyebrow">Provider setup</p>
      <h2>Stripe</h2>
      <p>Manage Stripe credentials, API verification, webhook setup, and checkout methods.</p>
    </div>
    <button type="button" class="iconButton" aria-label="Close provider setup">×</button>
  </header>

  <div class="drawerBody">
    <section class="drawerCard">
      <h3>Connection status</h3>
      <p>Verified means API verification passed. Checkout active means Doopify will actually use this connection for payment creation.</p>
      <div class="statusGrid">
        <div><span>Status</span><strong>Env keys found</strong></div>
        <div><span>Runtime source</span><strong>Not configured</strong></div>
        <div><span>Mode</span><strong>Test</strong></div>
        <div><span>Webhook</span><strong>Missing</strong></div>
      </div>
    </section>

    <section class="drawerCard">
      <h3>Stripe credentials</h3>
      <p>Save credentials securely. After saving, clear the fields and only show masked values.</p>
      <div class="formGrid">
        <label>Publishable key <input placeholder="pk_test_..." /></label>
        <label>Secret key <input type="password" placeholder="sk_test_..." /></label>
        <label>Webhook secret <input type="password" placeholder="whsec_..." /></label>
        <label>Mode <select><option>Test</option><option>Live</option></select></label>
      </div>
      <div class="drawerActions">
        <button type="button" class="buttonPrimary">Save credentials</button>
        <button type="button" class="buttonSecondary">Verify Stripe API</button>
        <button type="button" class="buttonSecondary">Copy webhook endpoint</button>
      </div>
    </section>

    <section class="drawerCard">
      <h3>Checkout methods through Stripe</h3>
      <p>Cards can be active when Stripe runtime is active. Wallet methods depend on account eligibility, live mode, HTTPS, and domain verification.</p>
      <div class="methodChips"><span>Cards</span><span>Apple Pay: needs domain</span><span>Google Pay</span><span>Link</span><span>Cash App: live mode</span></div>
    </section>

    <section class="drawerCard dangerZone">
      <h3>Danger zone</h3>
      <p>Disconnecting Stripe removes the DB-backed provider connection. Env fallback may still work if env keys are configured.</p>
      <button type="button" class="buttonDanger">Disconnect Stripe</button>
    </section>
  </div>
</aside>
```

## PayPal Drawer Behavior

PayPal should have a **Manage** button for UX consistency, but should not be marked active until backend/runtime support exists.

Current PayPal drawer should say:

- status: setup needed
- runtime source: not implemented
- checkout: hidden
- methods: PayPal, Pay Later, Venmo

It can show future credential fields, but the UI must explain that PayPal runtime payment creation, webhook verification, refund support, and order finalization must be implemented before enabling it at checkout.

## Manual Payments Drawer Behavior

Manual payments should use the same drawer pattern.

It should eventually support:

- cash instructions
- bank transfer instructions
- invoice/manual payment flow
- whether manual methods are available for draft orders only or storefront checkout

## Style Guidance

Keep the final implementation consistent with Doopify global style components:

- use shared buttons instead of new button styles
- use shared badges/status pills instead of one-off badge CSS
- use shared cards/panels where available
- use shared drawer/slide-over if available
- use existing settings form rows and help text patterns
- use CSS module classes that map to existing tokens
- do not hardcode raw colors when tokens exist
- keep provider rows compact: icon, title/status, short copy, chips, action
- do not show private credential fields on the main payments page

## Accessibility Notes

- Manage buttons should have clear labels.
- Drawer should trap focus if the existing drawer component supports it.
- Escape should close the drawer.
- Backdrop click can close the drawer.
- Secret inputs should use password fields.
- Saved secret values should never be rendered raw.

## Build Acceptance Criteria

- Payments page is compact and list-based.
- Stripe, PayPal, and Manual payments appear as provider rows.
- Manage opens a slide-over drawer.
- Stripe drawer uses real provider/runtime status and existing credential APIs.
- PayPal drawer is future-ready but honest that runtime support is not active.
- Manual payments drawer is future-ready for offline payment instructions.
- Customer checkout methods section clearly explains what customers can use.
- Payment activity section shows real payment/refund events or an honest empty state.
- No raw secrets appear on the main page or after save.
- Styling uses Doopify global/shared components and tokens where possible.
