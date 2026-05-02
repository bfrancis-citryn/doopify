# Component Consolidation Audit

Date: 2026-05-01  
Scope: `src/components` legacy/non-feature-based folders (read-only audit)

## Method
- Reviewed top-level component folders under `src/components`.
- Searched import/references with `rg` for each suspected legacy folder and file.
- Classified by current usage safety, without moving/deleting code.

## Classification Summary

### `src/components/Header/`
- Classification: `duplicate but not safe to delete yet`
- Why:
  - `Header.js` is imported by `src/components/AppShell.js`.
  - There is also `src/components/admin/ui/AdminPageHeader.jsx` serving similar header concerns in another UI pattern.
- Evidence:
  - `src/components/AppShell.js:4`
- Consolidation note:
  - Keep for now; later unify AppShell header behavior with admin UI primitives in one shell strategy.

### `src/components/Sidebar/`
- Classification: `duplicate but not safe to delete yet`
- Why:
  - `Sidebar.js` is imported by `src/components/AppShell.js`.
  - Navigation responsibilities partially overlap with admin page-shell patterns.
- Evidence:
  - `src/components/AppShell.js:5`
- Consolidation note:
  - Keep for now; migrate only after AppShell shell consolidation.

### `src/components/ProductList/`
- Classification: `unused and safe to delete`
- Why:
  - No imports found outside its own file.
  - No route/page references found to `components/ProductList/ProductList`.
- Evidence:
  - Only self-reference found: `src/components/ProductList/ProductList.js`
- Consolidation note:
  - Candidate for removal in a dedicated cleanup PR.

### `src/components/ProductDetail/`
- Classification: `unused and safe to delete`
- Why:
  - No imports found to `components/ProductDetail/ProductDetail`.
  - Storefront product detail currently uses route-local component: `src/app/(storefront)/shop/[handle]/ProductDetail.js`.
- Evidence:
  - Active storefront usage: `src/app/(storefront)/shop/[handle]/page.js:2`
  - Legacy component file exists but is not imported elsewhere: `src/components/ProductDetail/ProductDetail.js`
- Consolidation note:
  - Candidate for removal in a dedicated cleanup PR.

### `src/components/MediaLibrary/`
- Classification: `unused and safe to delete` (already absent)
- Why:
  - Folder is no longer present.
  - Active media workspace is feature-based under `src/components/media/MediaLibraryWorkspace.js`.
- Evidence:
  - `src/app/(dashboard)/media/page.js:1`
- Consolidation note:
  - No further action needed.

### `src/components/layout/`
- Classification: `active but should move later`
- Why:
  - Contains shared shell CSS used by AppShell and Products workspace.
- Evidence:
  - `src/components/AppShell.js:6`
  - `src/components/products/ProductsWorkspace.js:10`
- Consolidation note:
  - Consider co-locating with AppShell feature shell (`src/components/app-shell/` or similar) in a later refactor.

### `src/components/AppShell.js` (root singleton component)
- Classification: `active and should stay`
- Why:
  - Core shell for many admin workspaces; removing/moving now would cause broad churn.
- Evidence:
  - Imported across analytics/admin/draft-orders/discounts/collections/webhooks/settings/customers/orders/products/media/brand-kit/abandoned-checkouts order detail pages.
- Consolidation note:
  - Keep as consolidation anchor; migrate dependents incrementally later.

### `src/components/ui/`
- Classification: `active but should move later`
- Why:
  - `etheral-shadow.tsx` is used by storefront homepage.
  - `demo.tsx` appears non-imported (likely local/demo artifact).
- Evidence:
  - `src/app/(storefront)/page.js:2`
  - No references found for `src/components/ui/demo.tsx`.
- Consolidation note:
  - Keep folder; consider removing/demo-isolating `demo.tsx` in future cleanup.

## Consolidation Priorities (no code changes in this PR)
1. **Safe cleanup candidates**
   - `src/components/ProductList/`
   - `src/components/ProductDetail/`
   - optionally `src/components/ui/demo.tsx`
2. **Shell consolidation candidates (requires staged refactor)**
   - `Header/` + `Sidebar/` + `AppShell.js` + `layout/AppShell.module.css`
   - Target: one consistent admin shell pattern aligned with current admin UI primitives.
3. **Keep as active feature components**
   - `src/components/media/MediaLibraryWorkspace.js`
   - `src/components/ui/etheral-shadow.tsx`

## Risk Notes
- Deleting `Header/` or `Sidebar/` now is not safe because AppShell directly imports both.
- ProductList/ProductDetail legacy folders appear removable, but should still be removed in a focused PR with verification.
- Any shell consolidation should avoid changing route behavior and should be staged to preserve admin UX.
