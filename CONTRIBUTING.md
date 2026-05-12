# Contributing

Thank you for contributing to Doopify.

---

## Before you start

Read in order:

1. [docs/STATUS.md](./docs/STATUS.md) — what is currently shipped and active
2. [docs/features-roadmap.md](./docs/features-roadmap.md) — build sequencing and phase priorities
3. [docs/HARDENING.md](./docs/HARDENING.md) — security/correctness expectations
4. [AGENTS.md](./AGENTS.md) — architecture constraints and agent rules

---

## Core rules

**Do not write placeholder commerce logic.** Any feature touching money, inventory, auth, email delivery, or public/private data boundaries must be implemented against the real service architecture.

**Keep Prisma central.** All core commerce persistence goes through Prisma. Do not introduce a second data source of truth.

**Keep checkout server-owned.** The client does not own totals, discounts, inventory truth, payment success, or order creation.

**Use existing patterns.** Before adding a file, search for an existing service, DTO, route response pattern, validation helper, or event type. Extend what exists.

---

## Verification gate

Run before every commit:

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

A change is not done until all four pass.

---

## Definition of done

A change is complete when:

- It fits the existing architecture
- It does not contradict `docs/STATUS.md`
- It keeps Prisma/Postgres as the source of truth
- It preserves server-owned checkout
- It does not expose private fields publicly
- It handles errors cleanly
- Status docs are updated if shipped status changed
- The verification gate passes

---

## Documentation

When a shipped/pending/deferred status changes, update:

- `docs/STATUS.md`
- `docs/features-roadmap.md`
- `docs/HARDENING.md` if security/correctness/ops changed
- `README.md` if onboarding changed
