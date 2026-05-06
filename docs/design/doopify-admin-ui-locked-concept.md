# Doopify Admin UI Locked Concept

Use the V7 glass admin mockup as the source of truth for the admin UI polish pass.

## Locked direction

- Base concept: V5/V7 dark + light glass dashboard
- Default accent: Ocean color option
- Spotlight effect: keep it subtle
- Compact modern buttons
- Button hover text/color from the first mockup direction
- Strong background gradient and glowing primary buttons
- Apple-glass-inspired light theme

## Patterns to carry into repo components

- Organized sidebar/tab structure
- Product/order slide-over drawer with blurred background
- Drawer context header, for example: `Orders / #1052 / Paid / Unfulfilled`
- Brand Kit moved inside Settings
- Product filter organization
- Skeleton loaders instead of spinners
- Selected-row state before drawer opens
- Live status dot for system health/webhook worker state
- Saved-state microcopy in Settings, for example: `✓ Saved 2s ago`

## Component extraction plan

Do not drop the whole static mockup into production. Extract into reusable admin tokens and components first:

- dashboard theme tokens
- compact Button variants
- GlassPanel / GlassCard
- Drawer / SlideOver
- StatusChip / LiveStatusDot
- Skeleton rows/cards
- SavedState microcopy
- table selected-row styling

## Exploratory notes

Neumorphic mockups are exploratory only and should not replace this locked glass direction unless explicitly approved later.
