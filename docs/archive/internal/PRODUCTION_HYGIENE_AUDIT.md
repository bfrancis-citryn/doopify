# Production Hygiene Grep Audit

Documentation date: May 2, 2026

## Goal

Classify production-facing `TODO`, `FIXME`, `HACK`, `not implemented`, `coming soon`, `mock`, `stub`, and `placeholder` matches without broad refactors or behavior changes.

This audit is intentionally conservative. It does not remove UI placeholder attributes, archived docs, design references, or test-only mocks/stubs.

## Search Scope Used

Equivalent target command:

```bash
rg "TODO|FIXME|HACK|not implemented|coming soon|mock|stub|placeholder" src --glob "!**/*.test.*" --glob "!**/__tests__/**"
```

Connector limitation: this pass used GitHub search and direct file inspection instead of a local `rg` run. The maintainer should still run the exact command locally before release claims.

## Small Fix Applied

### Payment provider setup copy

File:

```txt
src/components/settings/payments-settings.helpers.ts
```

Changed production-facing PayPal setup copy from:

```txt
Runtime support: not implemented
```

to:

```txt
Runtime support: unavailable
```

Classification: production-facing copy cleanup.

Reason: the provider remains disabled/hidden from checkout until the runtime, webhook, refund, and order-finalization path is built. The old phrase was implementation language and not merchant-facing enough.

## Accepted Exceptions

### Form placeholder attributes

Classification: harmless UI placeholder.

Many `placeholder` matches are normal input hints in admin forms and storefront forms. Do not remove these blindly.

Accepted examples include text inputs, search inputs, textarea guidance, URL fields, and amount fields.

### Tests and mocks

Classification: test-only.

`mock`, `stub`, and similar terms in `*.test.*` files are expected and are excluded from production-risk classification.

### Design and archived docs

Classification: non-runtime reference material.

Matches in `docs/design`, `docs/archive`, `design/`, and package lock metadata are not production code. They should not block release by themselves.

### Intentional future-provider UI copy

Classification: accepted future-facing status.

`Coming soon` appears in Settings for unavailable future providers/templates such as PayPal and unshipped email templates. This is acceptable only when:

- the provider/template is not active in checkout/runtime paths
- the UI clearly marks it unavailable or setup-needed
- no visible control claims the feature works
- server-owned checkout remains Stripe/manual-draft only until the future provider is implemented

### Product quick action toast

Classification: harmless informational placeholder, but candidate for later UX cleanup.

`ProductsWorkspace` still shows a toast that quick actions are coming soon. This is not commerce logic and does not affect product persistence, checkout, or order correctness. A future UI polish pass should either wire the action to a real command palette shortcut or hide the button.

### Draft order data helper

Classification: legacy-but-active helper.

`src/lib/draftOrdersData.js` appears legacy by name, but it is still referenced by the draft orders workspace and has test coverage. Do not delete it in a hygiene-only pass.

### Draft line price override TODO

File:

```txt
src/server/services/draft-order-conversion.service.ts
```

Classification: accepted schema/backlog note.

The TODO notes that schema-backed override audit fields on `OrderItem` should be added later. Current behavior still writes an order event for override visibility. This is not a fake commerce path and should be handled in a future schema-backed audit slice, not a hygiene cleanup.

## Production Risks Not Fixed In This Pass

None classified as safe, small, and obvious beyond the payment-provider copy cleanup.

## Follow-Up Recommendations

1. Run the exact local `rg` command before release claims.
2. Keep this audit paired with the full verification gate:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

3. Do not continue broad JSX/TSX conversion until current gates are green.
4. Consider a small future UX pass to hide or wire quick-action buttons that only show "coming soon" toasts.
5. Consider a future schema slice for draft line price override fields if draft orders become production-critical.

## Verification Required

This doc-only audit plus copy cleanup still requires local verification:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

`npm run test:integration` should also be run when `DATABASE_URL_TEST` is configured and the change affects real DB behavior. This hygiene pass did not intentionally change DB behavior.
