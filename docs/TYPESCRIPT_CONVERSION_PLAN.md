# TypeScript Conversion Plan

## Scope and constraints
- Inventory source: `rg --files src -g "*.js" -g "*.jsx"`
- Current JS/JSX count under src: 106 (down from 112 after core-server and checkout client conversion batches)
- `tsconfig.json` currently uses `allowJs: true`.
- `jsconfig.json` was removed after confirming `tsconfig.json` fully covers the `@/*` alias.
- This document is planning only; no runtime behavior changes.

## Inventory by area

### server/service/core commerce
- `src/lib/orders/getOrderByNumber.ts` (converted)
- `src/lib/orders/listOrders.ts` (converted)
- `src/lib/orders/mapDbOrderToViewModel.ts` (converted)
- `src/lib/orders/queries.ts` (converted)
- `src/lib/productUtils.js`

### API routes
- None

### checkout/order/payment UI
- `src/app/(dashboard)/orders/[orderNumber]/page.js`
- `src/app/(dashboard)/orders/page.js`
- `src/app/(storefront)/checkout/CheckoutClientPage.tsx` (converted)
- `src/app/(storefront)/checkout/page.js`
- `src/app/(storefront)/checkout/success/CheckoutSuccessClientPage.tsx` (converted)
- `src/app/(storefront)/checkout/success/page.js`
- `src/components/orders/OrderAdjustmentsCard.js`
- `src/components/orders/OrderDetailClientPage.js`
- `src/components/orders/OrderDetailView.jsx`
- `src/components/orders/OrdersWorkspace.js`

### admin UI
- `src/app/(dashboard)/admin/abandoned-checkouts/page.js`
- `src/app/(dashboard)/admin/brand-kit/page.js`
- `src/app/(dashboard)/admin/collections/page.js`
- `src/app/(dashboard)/admin/page.js`
- `src/app/(dashboard)/admin/settings/shipping/page.js`
- `src/app/(dashboard)/admin/settings/shipping/setup/page.js`
- `src/app/(dashboard)/admin/webhooks/page.js`
- `src/app/(dashboard)/analytics/page.js`
- `src/app/(dashboard)/customers/page.js`
- `src/app/(dashboard)/discounts/page.js`
- `src/app/(dashboard)/draft-orders/page.js`
- `src/app/(dashboard)/layout.js`
- `src/app/(dashboard)/login/page.js`
- `src/app/(dashboard)/media/page.js`
- `src/app/(dashboard)/products/page.js`
- `src/app/(dashboard)/settings/page.js`
- `src/app/_shared/fonts.js`
- `src/components/abandoned-checkouts/AbandonedCheckoutsWorkspace.js`
- `src/components/admin/AdminDashboardWorkspace.js`
- `src/components/admin/ui/AdminButton.jsx`
- `src/components/admin/ui/AdminCard.jsx`
- `src/components/admin/ui/AdminCommandPalette.jsx`
- `src/components/admin/ui/AdminDrawer.jsx`
- `src/components/admin/ui/AdminDropdown.jsx`
- `src/components/admin/ui/AdminEmptyState.jsx`
- `src/components/admin/ui/AdminField.jsx`
- `src/components/admin/ui/AdminFormSection.jsx`
- `src/components/admin/ui/AdminInput.jsx`
- `src/components/admin/ui/AdminLiveStatus.jsx`
- `src/components/admin/ui/AdminPage.jsx`
- `src/components/admin/ui/AdminPageHeader.jsx`
- `src/components/admin/ui/AdminSavedState.jsx`
- `src/components/admin/ui/AdminSchedulePopover.jsx`
- `src/components/admin/ui/AdminSelect.jsx`
- `src/components/admin/ui/AdminSelectableTile.jsx`
- `src/components/admin/ui/AdminSkeleton.jsx`
- `src/components/admin/ui/AdminSplitPane.jsx`
- `src/components/admin/ui/AdminSpotlightRuntime.jsx`
- `src/components/admin/ui/AdminStatCard.jsx`
- `src/components/admin/ui/AdminStatusChip.jsx`
- `src/components/admin/ui/AdminTable.jsx`
- `src/components/admin/ui/AdminTextarea.jsx`
- `src/components/admin/ui/AdminThemeProvider.jsx`
- `src/components/admin/ui/AdminThemeToggle.jsx`
- `src/components/admin/ui/AdminToolbar.jsx`
- `src/components/admin/ui/AdminTooltip.jsx`
- `src/components/admin/ui/AdminUploadDropzone.jsx`
- `src/components/analytics/AnalyticsWorkspace.js`
- `src/components/AppShell.js`
- `src/components/auth/LoginPortal.js`
- `src/components/brand-kit/BrandKitWorkspace.js`
- `src/components/collections/CollectionsWorkspace.js`
- `src/components/customers/CustomersWorkspace.js`
- `src/components/discounts/DiscountsWorkspace.js`
- `src/components/draft-orders/DraftOrdersWorkspace.js`
- `src/components/Header/Header.js`
- `src/components/media/MediaLibraryWorkspace.js`
- `src/components/products/ConfirmDialog.js`
- `src/components/products/ProductCatalog.js`
- `src/components/products/ProductEditorDrawer.js`
- `src/components/products/ProductMediaManager.js`
- `src/components/products/ProductStatusControl.jsx`
- `src/components/products/ProductsWorkspace.js`
- `src/components/products/ProductVariantEditor.js`
- `src/components/products/ToastViewport.js`
- `src/components/settings/IntegrationsPanel.js`
- `src/components/settings/SettingsWorkspace.js`
- `src/components/settings/ShippingSettingsWorkspace.js`
- `src/components/settings/ShippingSetupWorkspace.js`
- `src/components/Sidebar/Sidebar.js`
- `src/components/webhooks/delivery-logs.helpers.js`
- `src/components/webhooks/WebhookDeliveriesWorkspace.js`
- `src/context/CustomersContext.js`
- `src/context/DiscountsContext.js`
- `src/context/OrdersContext.js`
- `src/context/ProductContext.js`
- `src/context/ProductsContext.js`
- `src/context/SettingsContext.js`
- `src/lib/customersData.js`
- `src/lib/discountsData.js`
- `src/lib/draftOrdersData.js`
- `src/lib/ordersData.js`

### storefront UI
- `src/app/(storefront)/collections/[handle]/page.js`
- `src/app/(storefront)/collections/page.js`
- `src/app/(storefront)/layout.js`
- `src/app/(storefront)/page.js`
- `src/app/(storefront)/shop/[handle]/page.js`
- `src/app/(storefront)/shop/[handle]/ProductDetail.js`
- `src/app/(storefront)/shop/layout.js`
- `src/app/(storefront)/shop/page.js`
- `src/components/ProductDetail/ProductDetail.js`
- `src/components/ProductList/ProductList.js`
- `src/components/storefront/CartDrawer.js`
- `src/components/storefront/CollectionDetailView.js`
- `src/components/storefront/FeaturedCollectionsGrid.js`
- `src/context/CartContext.js`

### legacy/suspected unused
- `src/lib/db/prisma.js`

## Recommended phased conversion order
1. Phase 1 (lowest risk): shared leaf UI + helper utilities.
   - Convert admin UI primitives (`src/components/admin/ui/*`) and small helper modules (`src/components/webhooks/delivery-logs.helpers.js`, `src/app/_shared/fonts.js`).
2. Phase 2: state/context layer and shared shells.
   - Convert `src/context/*` and shared layout components (`AppShell`, `Header`, `Sidebar`).
3. Phase 3: admin workspaces and dashboard pages (non-checkout critical paths).
   - Convert settings/products/customers/discounts/media/collections/analytics/admin pages and their workspace components.
4. Phase 4: storefront browsing UI (non-payment path).
   - Convert storefront product/collection/listing/layout components and pages outside checkout.
5. Phase 5 (highest risk): checkout/order/payment-facing UI.
   - Convert order detail/workspace and storefront checkout pages/components with focused regression tests.
6. Phase 6: cleanup legacy/suspected-unused JS files.
   - Validate ownership/usage, then convert or remove (`src/lib/db/prisma.js`, and any confirmed unused components).

## Conversion progress
- April 2026 conversion batch (core server commerce):
  - `src/lib/orders/getOrderByNumber.js` -> `src/lib/orders/getOrderByNumber.ts`
  - `src/lib/orders/listOrders.js` -> `src/lib/orders/listOrders.ts`
  - `src/lib/orders/mapDbOrderToViewModel.js` -> `src/lib/orders/mapDbOrderToViewModel.ts`
  - `src/lib/orders/queries.js` -> `src/lib/orders/queries.ts`
- April 2026 conversion batch (checkout UI client pages):
  - `src/app/(storefront)/checkout/CheckoutClientPage.js` -> `src/app/(storefront)/checkout/CheckoutClientPage.tsx`
  - `src/app/(storefront)/checkout/success/CheckoutSuccessClientPage.js` -> `src/app/(storefront)/checkout/success/CheckoutSuccessClientPage.tsx`

## Risk notes and guardrails
- Keep `allowJs: true` until late phases to avoid blocking mixed TS/JS imports.
- For each phase, run: `npx tsc --noEmit`, `npm run test`, `npm run build`.
- Prefer converting leaf dependencies before modules that import many JS files.
- Do not change checkout/payment/order business logic during conversion-only PRs.
- `jsconfig.json` cleanup is complete; keep `tsconfig.json` as the single alias source of truth.
