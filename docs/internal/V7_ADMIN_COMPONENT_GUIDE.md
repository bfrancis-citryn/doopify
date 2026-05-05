# V7 Admin Component Guide

This guide is the source of truth for building or updating Doopify admin pages without drifting from the global V7 system.

## 1. Required Page Structure

Use the shared shell and page primitives in this order:

1. `AppShell`
2. `AdminPage`
3. `AdminPageHeader`
4. `AdminStatsGrid` + `AdminStatCard` (when the page has summary KPIs)
5. `AdminCard` sections for major content blocks
6. `AdminToolbar` for search/filter/action rows
7. `AdminTable` for data lists, otherwise `AdminEmptyState`
8. `AdminDrawer` for detail/edit flows

## 2. What Must Be Global Components

The global system owns visual behavior for:

- cards (`AdminCard`)
- buttons (`AdminButton`)
- inputs/textareas (`AdminInput`, `AdminTextarea`)
- selects/dropdowns (`AdminSelect`, `AdminDropdown`)
- drawers (`AdminDrawer`)
- tooltips (`AdminTooltip`)
- skeletons (`AdminSkeleton`)
- empty states (`AdminEmptyState`)
- status chips (`AdminStatusChip`)
- upload/dropzones (`AdminUploadDropzone`)
- schedule popovers (`AdminSchedulePopover`)
- selectable media tiles (`AdminSelectableTile` where applicable)

## 3. What Local CSS Modules Are Allowed To Do

Local module CSS should be layout-focused:

- grid/flex layout
- responsive sizing and breakpoints
- table/cell composition layout
- page-specific width/height constraints
- spacing needed for unique structure

## 4. What Local CSS Modules Should Not Do

Do not create local visual systems for:

- primary/secondary/danger buttons
- card/glass panels
- drawers
- selects/dropdowns
- tooltips
- status chips
- skeleton loaders
- hardcoded light/dark colors
- duplicated token styling that already exists in `dashboard-theme.css`

## 5. Example Page Skeleton

```jsx
<AppShell>
  <AdminPage>
    <AdminPageHeader
      eyebrow="Orders"
      title="Order desk"
      description="Server-owned order flow and fulfillment visibility."
      actions={<AdminButton size="sm" variant="secondary">Refresh</AdminButton>}
    />

    <AdminStatsGrid>
      <AdminStatCard label="Total" value="124" />
      <AdminStatCard label="Pending" value="18" />
    </AdminStatsGrid>

    <AdminCard variant="panel">
      <AdminToolbar>
        <AdminInput type="search" placeholder="Search..." />
        <AdminSelect value={status} onChange={setStatus} options={statusOptions} />
      </AdminToolbar>

      {rows.length ? (
        <AdminTable rows={rows} columns={columns} />
      ) : (
        <AdminEmptyState title="No results" description="Try adjusting filters." />
      )}
    </AdminCard>

    <AdminDrawer open={isOpen} onClose={closeDrawer} title="Details">
      {/* form fields and page-specific layout */}
    </AdminDrawer>
  </AdminPage>
</AppShell>
```

## 6. Theme Notes

- Use shared tokens from `src/app/_styles/dashboard-theme.css`.
- Do not hardcode dark-only or light-only backgrounds in page modules.
- Theme is controlled through `data-dashboard-theme` on `html`.
- `AdminThemeProvider` supports `light`, `dark`, and `system`.
- `system` follows `prefers-color-scheme` and updates when OS preference changes.
