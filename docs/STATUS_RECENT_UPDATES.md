# Recent Stabilization Updates

Documentation date: May 2, 2026

This addendum records stabilization work completed after the April 29 status refresh. Fold these bullets into `docs/STATUS.md` during the next local documentation cleanup pass.

## Shipped Stabilization Updates

- Added `docs/CHANGE_SAFETY_CHECKLIST.md` as the repo's small-phase safety gate for future agent/Codex/Claude work.
- Added `docs/PRODUCTION_HYGIENE_AUDIT.md` to classify production-facing TODO/placeholder/mock/stub search results without broad behavior changes.
- Cleaned production-facing payment provider copy by replacing PayPal's developer-facing `Runtime support: not implemented` label with `Runtime support: unavailable` while keeping PayPal unavailable until its server-owned payment, webhook, refund, and order-finalization path ships.
- Optimized admin product loading so default `GET /api/products` list usage can rely on lightweight summary payloads, with full product detail fetched only when needed for editor/detail workflows.
- Completed admin UI primitive JSX-to-TSX conversion for the remaining handcrafted admin primitives:
  - `AdminDrawer`
  - `AdminCommandPalette`
  - `AdminSchedulePopover`
- Removed the matching JSX originals after TSX replacements were created, avoiding parallel implementations in `src/components/admin/ui`.

## Required Local Verification

Run before marking these updates fully verified in `docs/STATUS.md`:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

Run integration coverage when a disposable test database is configured:

```bash
npm run test:integration
```

## Manual Smoke Tests

- `/products` loads quickly.
- Product list renders from lightweight summaries.
- Opening a product loads full detail.
- Product create/edit/save still works.
- Admin drawers open/close correctly.
- Command palette opens with keyboard shortcut and navigates.
- Schedule popover opens, positions, selects a date/time, clears, and publishes now.
- `/settings`, `/orders`, `/admin/webhooks`, `/media`, and `/admin/collections` render without console errors.

## Notes

- Do not continue broad JSX-to-TSX conversion until the verification gate is green.
- Keep future phases small and scoped by `docs/CHANGE_SAFETY_CHECKLIST.md`.
- If `docs/STATUS.md` is updated locally, remove this addendum only after the same information is represented there.
