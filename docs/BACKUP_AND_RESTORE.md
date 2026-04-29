# Backup And Restore

> Recovery notes for database incidents and rollback planning.
>
> Last updated: April 29, 2026

## Goals

- recover data safely after accidental mutation
- support production rollback without silent data loss
- preserve auditability during incident response

## Backup Strategy

Use both:

1. Neon branch/snapshot restore features (point-in-time and branch restore operations).
2. Periodic logical exports (`pg_dump`) stored in secure off-platform storage.

## Logical Backup Example

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --file doopify-prod-$(date +%Y%m%d-%H%M%S).dump
```

## Logical Restore Example

Restore to a non-production target first:

```bash
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" doopify-prod-YYYYMMDD-HHMMSS.dump
```

Never test restores directly against active production.

## Neon Restore Path

Preferred first recovery option for recent incidents:

- restore branch to earlier point-in-time, or
- restore from snapshot to recovery branch and validate before cutover.

After restoration:

1. validate schema/app compatibility
2. run smoke checks
3. only then promote/cut over compute traffic

## Incident Recovery Sequence

1. Freeze writes when feasible.
2. Capture current state (dump or branch snapshot).
3. Restore to recovery target.
4. Validate key invariants:
   - login
   - checkout creation
   - webhook processing
   - admin data access
5. Promote recovered target.
6. Record timeline and root cause notes.

## Related Runbooks

- `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `docs/ADMIN_USER_RECOVERY_GUIDE.md`
