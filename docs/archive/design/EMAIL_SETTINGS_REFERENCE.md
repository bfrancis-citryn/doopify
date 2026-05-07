# Email Settings Reference

> Design/build reference for rebuilding `Settings -> Email` as a customer-message-focused settings area.
>
> Created: April 30, 2026
> Status: design/build reference

## Intent

The Email settings tab should not feel like a raw provider credential screen. It should clearly explain what emails Doopify sends, how a merchant connects a provider, how sender identity/branding works, and how templates are edited/tested.

The current UI is too provider-centric and bulky. The new UI should be compact, organized, and functional.

## Product Decision

`Settings -> Email` owns customer/admin email delivery and templates:

- provider setup
- sender identity
- email branding
- customer email templates
- recent email activity

Do not keep private credential forms permanently visible on the main page. Provider credentials should live inside `Manage` drawers.

## Brand Kit Decision

Do not keep `Brand kit` as the top-level first settings tab unless it powers real outputs.

Recommended structure:

```txt
General
Payments
Shipping & delivery
Email
Webhooks
Checkout
Storefront
Setup
```

Move branding controls to where they are used:

- `Email` owns email logo, accent color, footer, and email template visuals.
- `Storefront` owns storefront logo/colors/typography.
- `Checkout` owns checkout logo/colors/trust copy.
- `General` owns store name, support email, store address, legal identity, and default contact details.

A future `Brand assets` page can exist once it actually feeds storefront, checkout, email, receipts, packing slips, and invoices.

## Email Types To Support

### Phase 1 — Must-have transactional emails

- Order confirmation
- Shipping confirmation / tracking number
- Refund confirmation
- Draft order invoice
- Customer note / order update

### Phase 2 — Growth and operational emails

- Abandoned checkout
- New order admin notification
- Low stock admin alert
- Delivered notification
- Return started / approved / received

### Phase 3 — Advanced lifecycle

- Back-in-stock
- Review request
- Win-back email
- Customer account invite

Only show a template as active when the backend actually sends it.

## Main Page Structure

The Email page should show:

1. compact setup checklist
2. email providers
3. sender identity
4. email branding
5. customer email templates
6. recent email activity

Keep text short. Avoid giant explanatory blocks.

## Layout Reference

Use this as layout/content guidance only. Do not copy this into production as a separate visual system. Use existing Doopify shared/global components, settings cards, buttons, badges, drawers, inputs, CSS modules, and tokens.

```html
<section class="settingsPanel emailSettings">
  <header class="settingsPageHeader">
    <div>
      <p class="settingsEyebrow">Settings</p>
      <h1>Email</h1>
      <p>Send customer emails for orders, shipping, refunds, draft invoices, abandoned carts, and store updates.</p>
    </div>

    <button type="button" class="buttonPrimary">Send test email</button>
  </header>

  <section class="settingsInfoStrip compact">
    <strong>Email setup</strong>
    <p>Connect a provider, set sender identity, add branding, then test the templates customers receive.</p>

    <div class="setupChecklist compact">
      <span>Provider connected</span>
      <span>Sender identity</span>
      <span>Email branding</span>
      <span>Templates tested</span>
    </div>
  </section>

  <section class="settingsCard providerListCard">
    <header class="settingsCardHeader">
      <div>
        <h2>Email providers</h2>
        <p>Choose the service Doopify uses to send transactional emails.</p>
      </div>
    </header>

    <div class="providerList">
      <article class="providerRow">
        <div class="providerIcon">R</div>
        <div>
          <div class="titleLine">
            <h3>Resend</h3>
            <span class="statusBadge warning">Webhook missing</span>
          </div>
          <p>API key found. Add webhook verification to track bounces, complaints, and delivery events.</p>
        </div>
        <button type="button" class="buttonPrimary">Manage</button>
      </article>

      <article class="providerRow">
        <div class="providerIcon">S</div>
        <div>
          <div class="titleLine">
            <h3>SMTP</h3>
            <span class="statusBadge neutral">Not configured</span>
          </div>
          <p>Connect any SMTP service using host, port, username, password, and sender settings.</p>
        </div>
        <button type="button" class="buttonSecondary">Manage</button>
      </article>

      <article class="providerRow">
        <div class="providerIcon">L</div>
        <div>
          <div class="titleLine">
            <h3>SendLayer</h3>
            <span class="statusBadge neutral">Coming soon</span>
          </div>
          <p>SendLayer support is planned. Use Resend or SMTP for now.</p>
        </div>
        <button type="button" class="buttonSecondary">Manage</button>
      </article>
    </div>
  </section>

  <div class="settingsTwoColumnGrid">
    <section class="settingsCard senderIdentityCard">
      <header class="settingsCardHeader">
        <div>
          <h2>Sender identity</h2>
          <p>Controls what customers see in their inbox.</p>
        </div>
        <button type="button" class="buttonSecondary">Save</button>
      </header>

      <div class="settingsFormRows">
        <label>From name <input value="Aspire Merch Shop" /></label>
        <label>From email <input value="store@aspirecounselingservice.com" /></label>
        <label>Reply-to email <input value="support@aspirecounselingservice.com" /></label>
      </div>
    </section>

    <section class="settingsCard emailBrandingCard">
      <header class="settingsCardHeader">
        <div>
          <h2>Email branding</h2>
          <p>Logo and visual style used inside customer emails.</p>
        </div>
        <button type="button" class="buttonSecondary">Edit</button>
      </header>

      <div class="emailBrandPreview">
        <div class="emailLogoBox">LOGO</div>
        <div class="emailPreviewMini">
          <strong>Thanks for your order, Sam</strong>
          <p>Your order #DPY0001 has been confirmed. We’ll email you again when it ships.</p>
        </div>
        <button type="button" class="buttonSecondary">Upload email logo</button>
      </div>
    </section>
  </div>

  <section class="settingsCard templateListCard">
    <header class="settingsCardHeader">
      <div>
        <h2>Customer email templates</h2>
        <p>Choose which emails send automatically and customize their content.</p>
      </div>
    </header>

    <div class="templateList">
      <article class="templateRow">
        <div>
          <div class="titleLine"><h3>Order confirmation</h3><span class="statusBadge success">Enabled</span></div>
          <p>Sent after an order is paid or finalized.</p>
        </div>
        <span class="statusBadge neutral">order.paid</span>
        <span class="muted">Last sent today</span>
        <button type="button" class="buttonPrimary">Manage</button>
      </article>

      <article class="templateRow">
        <div>
          <div class="titleLine"><h3>Shipping confirmation</h3><span class="statusBadge success">Enabled</span></div>
          <p>Sent when a label is purchased or tracking is added.</p>
        </div>
        <span class="statusBadge neutral">fulfillment.created</span>
        <span class="muted">Not sent yet</span>
        <button type="button" class="buttonPrimary">Manage</button>
      </article>

      <article class="templateRow">
        <div>
          <div class="titleLine"><h3>Refund confirmation</h3><span class="statusBadge success">Enabled</span></div>
          <p>Sent when a refund is created or completed.</p>
        </div>
        <span class="statusBadge neutral">order.refunded</span>
        <span class="muted">Not sent yet</span>
        <button type="button" class="buttonPrimary">Manage</button>
      </article>

      <article class="templateRow">
        <div>
          <div class="titleLine"><h3>Draft order invoice</h3><span class="statusBadge neutral">Ready</span></div>
          <p>Sent manually when a merchant sends an invoice or quote.</p>
        </div>
        <span class="statusBadge neutral">manual</span>
        <span class="muted">Draft orders</span>
        <button type="button" class="buttonPrimary">Manage</button>
      </article>

      <article class="templateRow">
        <div>
          <div class="titleLine"><h3>Abandoned checkout</h3><span class="statusBadge warning">Coming soon</span></div>
          <p>Sent when a customer leaves checkout before completing payment.</p>
        </div>
        <span class="statusBadge neutral">checkout.abandoned</span>
        <span class="muted">Not active</span>
        <button type="button" class="buttonSecondary">Preview</button>
      </article>
    </div>
  </section>

  <section class="settingsCard emailActivityCard">
    <header class="settingsCardHeader">
      <div>
        <h2>Recent email activity</h2>
        <p>Latest customer emails sent by Doopify.</p>
      </div>
      <a class="buttonSecondary" href="/admin/webhooks">View delivery logs</a>
    </header>

    <div class="activityList">
      <article class="activityRow">
        <span class="muted">2:46 PM</span>
        <div>
          <div class="titleLine"><h3>Shipping confirmation</h3><span class="statusBadge success">Delivered</span></div>
          <p>guest@example.com · #DPY0001 · Resend</p>
        </div>
        <span class="muted">1 attempt</span>
        <button type="button" class="buttonSecondary">View</button>
      </article>
    </div>
  </section>
</section>
```

## Provider Drawer Reference

Provider credential fields should live in a drawer.

```html
<aside class="settingsDrawer" aria-label="Email provider setup">
  <header class="drawerHeader">
    <div>
      <p class="settingsEyebrow">Provider setup</p>
      <h2>Resend</h2>
      <p>Manage API credentials, webhook verification, and test delivery.</p>
    </div>
    <button type="button" class="iconButton" aria-label="Close provider setup">×</button>
  </header>

  <div class="drawerBody">
    <section class="drawerCard">
      <h3>Connection status</h3>
      <p>Active means Doopify can send transactional emails through this provider.</p>
      <div class="statusGrid">
        <div><span>Status</span><strong>API key found</strong></div>
        <div><span>Active source</span><strong>Not active</strong></div>
        <div><span>Webhook</span><strong>Missing</strong></div>
        <div><span>Last verified</span><strong>Never</strong></div>
      </div>
    </section>

    <section class="drawerCard">
      <h3>Credentials</h3>
      <p>Credentials are encrypted. Saved secrets should only display as masked values.</p>
      <label>Resend API key <input type="password" placeholder="re_..." /></label>
      <label>Webhook secret <input type="password" placeholder="whsec_..." /></label>
      <div class="drawerActions">
        <button type="button" class="buttonPrimary">Save credentials</button>
        <button type="button" class="buttonSecondary">Verify provider</button>
        <button type="button" class="buttonSecondary">Send test email</button>
      </div>
    </section>
  </div>
</aside>
```

## Template Editor Drawer Reference

Start with a practical HTML/rich-text editor, not a full drag-and-drop builder.

```html
<aside class="settingsDrawer" aria-label="Email template editor">
  <header class="drawerHeader">
    <div>
      <p class="settingsEyebrow">Template editor</p>
      <h2>Order confirmation</h2>
      <p>Customize the subject, content, variables, and preview for this email.</p>
    </div>
    <button type="button" class="iconButton" aria-label="Close template editor">×</button>
  </header>

  <div class="drawerBody">
    <section class="drawerCard">
      <h3>Email content</h3>
      <label>Subject <input value="Thanks for your order, {{ customer.firstName }}" /></label>
      <label>Preview text <input value="Your order {{ order.number }} has been confirmed." /></label>
      <label>HTML / body
        <textarea rows="8">Hi {{ customer.firstName }},

Thanks for your order {{ order.number }}.

Total: {{ order.total }}

We’ll send another email when your order ships.</textarea>
      </label>
      <div class="drawerActions">
        <button type="button" class="buttonSecondary">Preview</button>
        <button type="button" class="buttonSecondary">Send test</button>
        <button type="button" class="buttonPrimary">Save template</button>
      </div>
    </section>

    <section class="drawerCard">
      <h3>Available variables</h3>
      <div class="variableGrid">
        <span>{{ store.name }}</span>
        <span>{{ store.logoUrl }}</span>
        <span>{{ customer.firstName }}</span>
        <span>{{ order.number }}</span>
        <span>{{ order.total }}</span>
        <span>{{ order.trackingNumber }}</span>
        <span>{{ order.trackingUrl }}</span>
        <span>{{ support.email }}</span>
      </div>
    </section>

    <section class="drawerCard">
      <h3>Preview</h3>
      <div class="emailPreviewMini">
        <strong>Thanks for your order, Sam</strong>
        <p>Your order #DPY0001 has been confirmed. Total: $999.00.</p>
      </div>
    </section>
  </div>
</aside>
```

## Functional Requirements

This should not be mock-only. The implementation should wire real behavior.

### Provider setup

- Save credentials to encrypted provider storage.
- Verify provider where supported.
- Send test email through the active provider.
- Do not expose raw secrets after save.
- Resend and SMTP should use existing provider runtime if available.
- SendLayer should stay coming soon unless implemented.

### Sender identity

- Persist from name, from email, reply-to, support email.
- Email sending runtime should use these values.
- Validate emails.

### Email branding

- Persist email logo URL or media id where supported.
- Persist email accent color/footer fields if added.
- Email templates should read branding values.
- If using Storefront/Brand logo as default, make that explicit.
- Do not keep top-level Brand Kit unless it powers real output.

### Templates

- Templates should be persisted.
- Templates should support subject, preview text, body/html, enabled status.
- Templates should support variables.
- Send test should render variables using sample data.
- Template editor should be functional for Phase 1 templates.

### Automatic sending

Phase 1 templates must be wired into real flows:

- Order confirmation -> after order is paid/finalized.
- Shipping confirmation -> when tracking is added or fulfillment is created with tracking/send flag.
- Refund confirmation -> when refund is created/completed.
- Draft order invoice -> when merchant explicitly sends draft invoice/quote.
- Customer note/order update -> when merchant sends customer-visible note from order detail.

Do not mark a template Enabled unless it has a sending path.

## Text/Copy Guidance

Keep copy short.

Use compact phrases:

- `Connect provider`
- `Sender identity`
- `Email branding`
- `Customer templates`
- `Send test`
- `View delivery logs`

Avoid bulky paragraphs on the main page.

## Style Guidance

Use global/shared Doopify components and conventions:

- settings layout/sidebar
- shared cards/panels
- shared provider rows
- shared buttons
- shared badges/status pills
- shared drawer/slide-over
- shared inputs/forms
- existing CSS tokens/classes/CSS modules

Do not build a separate one-off design system.

## Build Acceptance Criteria

- Email tab is compact and customer-message-focused.
- Provider forms are hidden behind Manage drawers.
- Sender identity persists and is used by email runtime.
- Email branding can be set and used by templates.
- Template list is visible and understandable.
- Template editor saves real templates.
- Test email sends through active provider.
- Phase 1 automatic emails are actually sent by the relevant app flows.
- Unsupported emails are not marked active.
- Raw secrets are never shown after save.
- Recent email activity links to Delivery logs.
