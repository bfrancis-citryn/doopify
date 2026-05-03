# Doopify Change Safety Checklist

Use this checklist before every new implementation phase.

## Scope Rule

Every change must define:

- goal
- expected files to change
- files that must not change
- verification commands
- manual smoke-test path

Do not bundle unrelated refactors with feature work.

## Default Verification Gate

Run after every meaningful source change:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
npm run test:integration
```

If `DATABASE_URL_TEST` is not configured, integration tests may skip, but the command should still be run so the skip is explicit.

## No-Go Rules

Do not:

- convert more JSX to TSX unless the phase is specifically about that component
- change admin UI classes, layout, or DOM structure unless the phase is UI design
- touch checkout, orders, payments, refunds, returns, webhooks, or email delivery without tests
- change API response shapes without updating every known consumer
- leave parallel implementations of the same component or service
- commit generated `.next`, `node_modules`, coverage, or build artifacts
- edit generated `.next/dev/types` files
- mix performance work with visual cleanup
- introduce fake payment, order, inventory, pricing, email, setup, or provider logic

## Source-Of-Truth Rules

- `docs/STATUS.md` is the current repo truth.
- `docs/features-roadmap.md` is the build sequence.
- `docs/HARDENING.md` is the security, correctness, and operations backlog.
- `docs/PROJECT_INTENT.md` is the product direction.
- `AGENTS.md` is the agent operating contract.

If these conflict, update the docs instead of creating a competing roadmap.

## Required Smoke Tests By Area

### Products

- `/products` loads quickly.
- Product list renders from the lightweight summary response.
- Opening a product loads full detail.
- Product create, edit, save, duplicate, and delete still work.
- Product media still displays.

### Checkout

- Storefront product can be added to checkout.
- Shipping rates load from server-owned config.
- Tax behaves according to settings.
- Stripe PaymentIntent is created by the server.
- Success/failure polling reflects checkout state.

### Orders

- Order list loads.
- Order detail loads.
- Refund and return panels load.
- Refund creation still follows server-owned validation.
- Return transitions still follow the state machine.

### Media

- `/media` loads.
- Upload works.
- Delete works.
- Product-linked media displays.
- SVG rejection and MIME validation remain intact.

### Webhooks, Email, And Jobs

- `/admin/webhooks` loads.
- Inbound replay/retry controls work where eligible.
- Outbound retry controls work where eligible.
- Email delivery detail and resend controls work where eligible.
- Job runner status loads.
- Audit logs are emitted where the route/service already supports them.

### Settings

- General settings load and save.
- Payments provider drawer opens without exposing raw secrets.
- Shipping and delivery settings load.
- Email settings load.
- Setup tab remains guidance/status only and does not run local shell commands.

## Commit Rule

Use small commits. Commit messages should start with one of:

- `Fix:`
- `Perf:`
- `Test:`
- `Docs:`
- `Refactor:`

Avoid giant mixed-purpose commits.

## Before Marking A Phase Complete

Confirm:

- verification gate was run locally
- manual smoke test paths were checked
- docs were updated only when status changed
- no generated files were committed
- no public response exposes private data or secrets
- checkout/payment/order/inventory truth remains server-owned
