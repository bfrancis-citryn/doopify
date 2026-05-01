# Compact Webhooks Settings Reference

> Design/build reference for simplifying `Settings -> Webhooks` into a compact outbound endpoint manager.
>
> Created: April 30, 2026
> Status: design/build reference

## Intent

The Webhooks tab should not feel like a developer dashboard. It should explain, in plain merchant language, that outbound webhooks send store updates from Doopify to another app using a URL from that app.

Most users do **not** need to think about HTTP payloads, retry internals, raw event names, provider webhooks, or signing details on the main screen.

## Core Mental Model

```txt
Webhooks = Doopify sends store updates to another app.
Email setup is not required.
```

Examples:

- Doopify -> Zapier
- Doopify -> Make
- Doopify -> Slack
- Doopify -> warehouse/fulfillment system
- Doopify -> CRM/ERP
- Doopify -> custom backend

Provider webhooks are different and should live in the provider setup areas:

- Stripe/payment provider webhooks -> `Settings -> Payments -> Provider drawer`
- Email delivery/provider webhooks -> `Settings -> Email -> Provider drawer`
- Shipping provider callbacks -> `Settings -> Shipping -> Provider drawer`

## Main Page Should Only Show

1. A compact explainer.
2. Connected endpoints.
3. Needs-attention issues.
4. Create endpoint action.

Advanced details like exact event names, payload samples, signing secret details, delivery logs, and retry controls should live inside the endpoint drawer/details view.

## Compact Layout Reference

```html
<section class="settingsPanel webhooksSettings">
  <header class="settingsPageHeader">
    <div>
      <p class="settingsEyebrow">Settings</p>
      <h1>Outbound webhooks</h1>
      <p>Send store updates to another app using a URL from that app. Email setup is not required.</p>
    </div>

    <button type="button" class="buttonPrimary">Create endpoint</button>
  </header>

  <section class="settingsInfoStrip">
    <strong>What does this do?</strong>
    <p>
      Webhooks send data to apps like Zapier, Make, Slack, a warehouse, CRM, or custom backend.
      Stripe, email, and shipping provider webhooks are set up inside their own settings.
    </p>

    <div class="settingsPillRow">
      <span>Doopify -> external app</span>
      <span>No SMTP needed</span>
      <span>Requires destination URL</span>
    </div>
  </section>

  <section class="settingsCard endpointListCard">
    <header class="settingsCardHeader">
      <div>
        <h2>Connected endpoints</h2>
        <p>Apps receiving updates from Doopify.</p>
      </div>
      <button type="button" class="buttonPrimary">Create</button>
    </header>

    <div class="endpointList">
      <article class="endpointRow">
        <div class="endpointTitle">
          <strong>Warehouse sync</strong>
          <span>warehouse.example.com/doopify</span>
        </div>

        <div class="endpointChips">
          <span>Paid orders</span>
          <span>Fulfillments</span>
        </div>

        <div class="endpointStatus">
          <span class="statusBadge success">Active</span>
          <small>Sent 2m ago</small>
        </div>

        <button type="button" class="buttonSecondary">Manage</button>
      </article>

      <article class="endpointRow">
        <div class="endpointTitle">
          <strong>Slack alerts</strong>
          <span>hooks.slack.com/services/••••</span>
        </div>

        <div class="endpointChips">
          <span>Paid orders</span>
          <span>Refunds</span>
        </div>

        <div class="endpointStatus">
          <span class="statusBadge warning">Issue</span>
          <small>HTTP 500</small>
        </div>

        <button type="button" class="buttonSecondary">Manage</button>
      </article>
    </div>
  </section>

  <section class="settingsCard needsAttentionCard">
    <header class="settingsCardHeader">
      <div>
        <h2>Needs attention</h2>
        <p>Failed updates that may need a fix.</p>
      </div>
    </header>

    <div class="issueList">
      <article class="issueRow">
        <div>
          <strong>Slack alerts failed</strong>
          <span>Doopify will retry in 9 minutes. Last response: HTTP 500.</span>
        </div>
        <button type="button" class="buttonSecondary">View</button>
      </article>
    </div>
  </section>
</section>
```

## Create Endpoint Drawer Reference

Use an existing Doopify drawer/slide-over component if one exists. Do not build a one-off modal system if there is already a shared drawer pattern.

```html
<aside class="settingsDrawer" aria-label="Create outbound webhook endpoint">
  <header class="drawerHeader">
    <div>
      <p class="settingsEyebrow">Create endpoint</p>
      <h2>Connect another app</h2>
      <p>Get a webhook URL from Zapier, Make, Slack, or your custom app. Paste it here and choose what Doopify should send.</p>
    </div>
    <button type="button" class="iconButton" aria-label="Close endpoint setup">×</button>
  </header>

  <div class="drawerBody">
    <section class="drawerCard">
      <h3>1. Destination</h3>
      <p>This is the URL from the app you want to connect.</p>

      <label>Endpoint name <input placeholder="Warehouse sync" /></label>
      <label>Destination URL <input placeholder="https://example.com/doopify/webhooks" /></label>
    </section>

    <section class="drawerCard">
      <h3>2. Updates to send</h3>
      <p>Pick simple groups. Doopify maps these to the correct internal events.</p>

      <div class="eventOptionGrid">
        <label><input type="checkbox" checked /> <strong>Paid orders</strong><span>When payment is confirmed.</span></label>
        <label><input type="checkbox" /> <strong>Refunds</strong><span>When money is refunded.</span></label>
        <label><input type="checkbox" /> <strong>Fulfillments</strong><span>When items are shipped.</span></label>
        <label><input type="checkbox" /> <strong>Customers</strong><span>When customers are created.</span></label>
      </div>
    </section>

    <section class="drawerCard">
      <h3>3. Security</h3>
      <p>Doopify signs requests so the receiving app can verify they came from your store.</p>
      <p class="securityNote">A signing secret will be generated automatically and stored encrypted. You only need this if the receiving app wants to verify requests.</p>
    </section>

    <section class="drawerCard">
      <h3>4. Test and save</h3>
      <p>Send a test update to make sure the destination URL is working.</p>

      <div class="drawerActions">
        <button type="button" class="buttonSecondary">Send test</button>
        <button type="button" class="buttonPrimary">Save endpoint</button>
      </div>
    </section>
  </div>
</aside>
```

## Friendly Event Groups

The main UI should show friendly event groups. The backend must map them to actual typed event names from the repo.

Suggested groups:

| Friendly label | Maps to actual typed events |
| --- | --- |
| Paid orders | `order.paid` |
| Refunds | refund/order refund events that actually exist |
| Fulfillments | fulfillment/tracking events that actually exist |
| Customers | customer events that actually exist |

Do not invent typed event names. If an event group does not map to implemented typed events, either hide it or label it coming soon.

## What To Hide From The Main Page

Keep these out of the main view unless the user clicks Manage/View:

- raw payloads
- raw event catalog
- signing secret details
- full delivery history table
- retry attempt internals
- provider webhook setup
- raw HTTP response bodies

## What To Show In Manage/View

Endpoint manage drawer/details can show:

- exact subscribed event names
- destination URL
- enabled/disabled state
- masked signing secret
- custom headers if supported
- latest deliveries
- retry now
- view payload/response if supported
- disable/delete endpoint

## Style Guidance

Keep implementation aligned with Doopify global/shared components:

- shared settings layout
- shared cards/panels
- shared buttons
- shared badges/status pills
- shared form rows
- shared drawer/slide-over component if available
- existing CSS tokens and CSS module conventions

Do **not** hardcode a separate design system from this mock. Treat the HTML as layout/content guidance only.

## Accessibility Notes

- Drawer should have a clear accessible label.
- Manage/Create buttons should describe their action.
- Escape should close the drawer if the shared component supports it.
- Focus should return to the trigger after close where possible.
- Statuses should be text, not color-only.

## Build Acceptance Criteria

- Webhooks tab is compact and understandable.
- User understands webhooks do not require email/SMTP setup.
- Main screen has explainer, connected endpoints, and needs-attention issues.
- Create endpoint opens a drawer.
- Drawer guides destination URL, updates to send, security, test/save.
- Friendly update groups map only to real typed events.
- Provider webhooks are not configured here.
- Signing secrets remain encrypted/masked.
- Existing outbound webhook APIs/services are reused.
