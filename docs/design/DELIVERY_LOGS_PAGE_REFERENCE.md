# Delivery Logs Page Reference

> Design/build reference for repositioning `/admin/webhooks` as **System -> Delivery logs**.
>
> Created: April 30, 2026
> Status: design/build reference

## Intent

The current `/admin/webhooks` page is useful, but the label **Webhooks** is confusing because Settings also has a Webhooks setup tab.

This page should not be where users create/configure outbound webhook endpoints. It should be an observability/debugging page for deliveries and events.

## Product Decision

Rename the user-facing System sidebar item:

```txt
Webhooks -> Delivery logs
```

Keep the route `/admin/webhooks` for now unless route rename is safe and low-risk.

## Clear Mental Model

```txt
Settings -> Webhooks = create/manage outbound endpoints
System -> Delivery logs = monitor what happened
```

Delivery logs should track:

- provider inbound webhooks, such as Stripe/payment provider events coming into Doopify
- outbound merchant webhooks, such as Doopify sending events to external apps
- transactional email deliveries, such as order confirmation, shipping confirmation, refund emails
- retries and failures

## Main Page Goals

The page should answer:

- What did Doopify receive?
- What did Doopify send?
- What failed?
- What will retry?
- Where do I go to set this up?

## User-Facing Copy

Title:

```txt
Delivery logs
```

Subtitle:

```txt
See what Doopify sent or received, what failed, and what will retry. This page is for monitoring — setup lives in Payments, Email, Shipping, and Settings -> Webhooks.
```

Setup callout:

```txt
Looking to set something up?
Use Settings -> Webhooks to create outbound endpoints. Stripe webhooks are in Payments, email delivery webhooks are in Email, and shipping callbacks are in Shipping.
```

## Stats

Do not show pagination as a stat card.

Use these stat cards instead:

- Received
- Processed
- Retrying
- Failed

If exact data is unavailable, derive safely from the existing API or show 0.

## Compact Layout Reference

Use this as layout/content guidance only. Do not create a separate one-off styling system. Use Doopify shared/global components, CSS modules, tokens, buttons, cards, badges, filters, and admin layout patterns.

```html
<main class="deliveryLogsPage">
  <nav class="adminTopbar">
    <div class="adminCrumb">Delivery logs</div>
    <div class="topbarActions">
      <button type="button" class="buttonSecondary">Refresh</button>
      <button type="button" class="buttonPrimary">New order</button>
    </div>
  </nav>

  <header class="pageHeader">
    <div>
      <p class="settingsEyebrow">System</p>
      <h1>Delivery logs</h1>
      <p>
        See what Doopify sent or received, what failed, and what will retry.
        This page is for monitoring — setup lives in Payments, Email, Shipping, and Settings -> Webhooks.
      </p>
    </div>

    <div class="quickActions">
      <a class="buttonSecondary" href="/admin/settings?section=webhooks">Manage outbound webhooks</a>
      <a class="buttonSecondary" href="/admin/settings?section=email">Email settings</a>
      <a class="buttonSecondary" href="/admin/settings?section=payments">Payment settings</a>
    </div>
  </header>

  <section class="statGrid">
    <article class="statCard">
      <span>Received</span>
      <strong>24</strong>
      <small>Provider events today</small>
    </article>

    <article class="statCard">
      <span>Processed</span>
      <strong>22</strong>
      <small>Successful deliveries</small>
    </article>

    <article class="statCard">
      <span>Retrying</span>
      <strong>2</strong>
      <small>Will run again automatically</small>
    </article>

    <article class="statCard">
      <span>Failed</span>
      <strong>1</strong>
      <small>Needs attention</small>
    </article>
  </section>

  <section class="settingsInfoStrip">
    <div>
      <strong>Looking to set something up?</strong>
      <p>
        Use Settings -> Webhooks to create outbound endpoints.
        Stripe webhooks are in Payments, email delivery webhooks are in Email,
        and shipping callbacks are in Shipping.
      </p>
    </div>

    <div class="settingsPillRow">
      <span>Monitor here</span>
      <span>Configure in Settings</span>
      <span>Retry failures</span>
    </div>
  </section>

  <section class="deliveryCategoryGrid">
    <article class="categoryCard">
      <strong>Provider webhooks</strong>
      <p>Stripe, email, and shipping providers sending events into Doopify.</p>
    </article>

    <article class="categoryCard">
      <strong>Outbound webhooks</strong>
      <p>Doopify sending store updates to external apps and endpoints.</p>
    </article>

    <article class="categoryCard">
      <strong>Email deliveries</strong>
      <p>Doopify sending customer and admin emails.</p>
    </article>
  </section>

  <section class="settingsCard deliveryTableCard">
    <header class="settingsCardHeader stacked">
      <div class="panelTitleRow">
        <div>
          <h2>Recent deliveries</h2>
          <p>Filter by type, status, event id, order, customer, provider, or error.</p>
        </div>
        <button type="button" class="buttonSecondary">Export</button>
      </div>

      <div class="filterGrid">
        <select aria-label="Delivery type filter">
          <option>All types</option>
          <option>Provider inbound</option>
          <option>Outbound webhooks</option>
          <option>Email deliveries</option>
        </select>

        <select aria-label="Delivery status filter">
          <option>All statuses</option>
          <option>Processed</option>
          <option>Delivered</option>
          <option>Retrying</option>
          <option>Failed</option>
        </select>

        <input aria-label="Search delivery logs" placeholder="Search event id, order, customer, provider, or error..." />
      </div>
    </header>

    <div class="deliveryRows">
      <article class="deliveryRow">
        <div class="deliveryTime">
          <strong>2:41 PM</strong>
          <span>Apr 30, 2026</span>
        </div>

        <span class="statusBadge success">Processed</span>

        <div class="deliveryMain">
          <strong>Stripe payment succeeded</strong>
          <span>Provider inbound · payment_intent.succeeded · #DPY0001</span>
        </div>

        <span class="muted">Stripe</span>
        <span class="muted">1 attempt</span>
        <button type="button" class="buttonSecondary">View</button>
      </article>

      <article class="deliveryRow">
        <div class="deliveryTime">
          <strong>2:42 PM</strong>
          <span>Apr 30, 2026</span>
        </div>

        <span class="statusBadge success">Delivered</span>

        <div class="deliveryMain">
          <strong>Warehouse sync received paid order</strong>
          <span>Outbound webhook · order.paid · #DPY0001</span>
        </div>

        <span class="muted">Warehouse</span>
        <span class="muted">1 attempt</span>
        <button type="button" class="buttonSecondary">View</button>
      </article>

      <article class="deliveryRow">
        <div class="deliveryTime">
          <strong>2:43 PM</strong>
          <span>Apr 30, 2026</span>
        </div>

        <span class="statusBadge warning">Retrying</span>

        <div class="deliveryMain">
          <strong>Slack alert failed</strong>
          <span>Outbound webhook · refund.created · HTTP 500 · retrying in 9m</span>
        </div>

        <span class="muted">Slack</span>
        <span class="muted">2 attempts</span>
        <button type="button" class="buttonSecondary">Retry</button>
      </article>

      <article class="deliveryRow">
        <div class="deliveryTime">
          <strong>2:46 PM</strong>
          <span>Apr 30, 2026</span>
        </div>

        <span class="statusBadge success">Delivered</span>

        <div class="deliveryMain">
          <strong>Shipping confirmation sent</strong>
          <span>Email delivery · shipping_confirmation · guest@example.com</span>
        </div>

        <span class="muted">Resend</span>
        <span class="muted">1 attempt</span>
        <button type="button" class="buttonSecondary">View</button>
      </article>
    </div>

    <footer class="paginationRow">
      <button type="button" class="buttonSecondary">Previous</button>
      <span>Page 1 of 4</span>
      <button type="button" class="buttonSecondary">Next</button>
    </footer>
  </section>
</main>
```

## Empty State Reference

Use this when there are no logs.

```html
<section class="settingsCard emptyDeliveryState">
  <strong>No delivery logs yet</strong>
  <p>
    Logs will appear here after provider webhooks, outbound webhooks, or customer emails are sent or received.
  </p>
  <div class="quickActions">
    <a class="buttonSecondary" href="/admin/settings?section=webhooks">Manage outbound webhooks</a>
    <a class="buttonSecondary" href="/admin/settings?section=email">Set up email</a>
    <a class="buttonSecondary" href="/admin/settings?section=payments">Set up payments</a>
  </div>
</section>
```

## Styling Guidance

Use global/shared Doopify components and conventions:

- existing admin layout/topbar
- existing sidebar/nav styling
- existing cards/panels
- existing stat cards if available
- existing buttons
- existing badges/status pills
- existing filter inputs/selects
- existing pagination controls
- CSS modules already used by `/admin/webhooks`

Do not copy the reference CSS into production as a separate system. The reference is for structure, copy, and density.

## Implementation Notes

- Keep `/admin/webhooks` route unless route rename is simple and safe.
- User-facing label should be Delivery logs.
- Sidebar label under System should be Delivery logs.
- Page title should be Delivery logs.
- `Page 1/1` belongs only in pagination, never in stat cards.
- Do not remove functionality: filtering, searching, pagination, viewing details, and retrying failed deliveries should remain if currently supported.
- Setup/config links should point to existing Settings sections if routes exist.

## Build Acceptance Criteria

- System sidebar says Delivery logs, not Webhooks.
- Page title says Delivery logs.
- Page explains this is for monitoring/debugging, not setup.
- Settings -> Webhooks remains the setup/configuration location.
- Stat cards are Received / Processed / Retrying / Failed.
- Pagination is not shown as a stat.
- Delivery categories explain provider inbound, outbound webhooks, and email deliveries.
- Empty state explains when logs appear and links to setup areas.
- Existing observability functionality is preserved.
