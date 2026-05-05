# Customer Data Posture

> Current customer data export/delete posture for Doopify.
>
> Last updated: May 5, 2026

## Current Support

### Data export (implemented)

- Admin-only export endpoint: `GET /api/customers/[id]/export`
- Returns customer profile, addresses, orders, order items, payments, refunds, and returns.
- Exports are audited via `audit.customer.data_exported`.

### Data deletion (planned)

- Full hard-delete is not enabled by default because historical order/accounting records must remain intact.
- Current recommended deletion posture is controlled anonymization:
  - clear direct contact fields
  - preserve financial/order records required for reconciliation and legal retention
  - keep audit trail of anonymization action and actor

## Operational Policy

- Restrict export actions to authenticated admin users.
- Never include provider secrets or internal auth/session fields in customer exports.
- Treat exported files as sensitive; store encrypted at rest and apply retention limits.

## Next Steps

1. Add owner-approved anonymization endpoint with audit logging and dry-run preview.
2. Add retention window settings for export artifacts.
3. Add admin UI controls for customer data requests and completion evidence.
