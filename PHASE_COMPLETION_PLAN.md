# Doopify Phase Completion Plan

> Sequenced completion plan for finishing Doopify, distilled from `STATUS.md`,
> `features-roadmap.md`, `HARDENING.md`, `PHASE_3_KICKOFF.md`, and `PROJECT_INTENT.md`.
>
> Documentation refresh: April 26, 2026
> Current active phase: **Phase 3 - Merchant Readiness And Storefront Differentiation**
>
> Source-of-truth precedence stays the same: `STATUS.md` (current state) >
> `features-roadmap.md` (build sequence) > `HARDENING.md` (security/correctness backlog).
> This plan does not replace those files; it sequences them.

## How To Use This Plan

Each phase below is a unit of completion big enough to deliver real merchant value
in a small number of PRs, but small enough that a single focused execution slice
keeps the commerce loop intact end-to-end. For each phase you get:

1. **Intent** - why the phase exists.
2. **In Scope / Out Of Scope** - what to build and what to refuse.
3. **Deliverables** - the concrete artifacts the phase must produce.
4. **Acceptance Checks** - the gates that prove the phase is done.
5. **Verification Commands** - the merge gate to run.
6. **Initiation Prompt** - a self-contained brief you can paste to start the phase.

The initiation prompts are written so that a fresh agent can read this plan plus the
five canonical docs and start executing without any other context.

## Scale Rationale

Phase 3 is sliced into five focused execution units (3A-3E) because it is the active
phase and each priority listed in `STATUS.md` deserves its own bounded slice. Phases
4-6 stay coarser because they are sequential platform-maturity steps where over-slicing
would create churn before the prior phase has been earned. Phase 7 is sliced into four
units (7A-7D) because launch readiness covers four very different skill domains
(operations, legal/security, developer experience, quality) that should be parallelizable
without blurring ownership. This is the smallest set of checkpoints that still preserves
accountability per delivery.

Phase 7 is the gate between "the product is done" and "you can launch it publicly." It
lives intentionally outside the product phases because the work is operational, legal,
and DX-shaped rather than commerce-domain-shaped. If you choose a narrower launch
(developer-first OSS release after Phase 3) instead of a full third-party-runs-it-in-
production launch, treat Phase 7 as the menu of items to pick from rather than a
single checkpoint.

---

## Phase 3 - Merchant Readiness And Storefront Differentiation (Active)

Phase 3 is partially shipped. Five remaining slices below complete it. Slices may run
in parallel only when they touch disjoint code paths; otherwise execute in order.

### Phase 3A - Broader Real-DB Race And Idempotency Coverage

**Intent.** The current real-DB integration suite covers paid-checkout inventory
decrement, duplicate payment-intent completion, competing duplicate completions,
insufficient-stock consistency, and paid-only/idempotent discount usage. Extend the
coverage so that every concurrent path through `POST /api/checkout/create` and
`POST /api/webhooks/stripe` stays deterministic.

**In Scope.**

- New `DATABASE_URL_TEST`-gated specs for: concurrent checkout creation against the
  same variant nearing stock-out, race between webhook success and webhook failure
  for the same payment intent, race between order confirmation email failure and
  order finalization, race between discount usage cap and concurrent paid-order
  finalization, race between session expiry and late webhook delivery.
- Service-layer fixes for any non-determinism the new tests surface, modeled on the
  customer-creation-race fix already shipped.
- A short note added to `HARDENING.md` describing each invariant the new specs lock
  in, so the regression set has narrative cover.

**Out Of Scope.**

- Any storefront UI work.
- Any pricing rule changes.
- Anything that moves logic out of the server pricing/checkout authority.

**Deliverables.**

- New specs under the existing real-DB integration test directory.
- Any service patches required to make the specs pass.
- Updated `HARDENING.md` "Inventory Hardening Target" / "Webhook Hardening Target"
  sections referencing the new coverage.
- `STATUS.md` "Phase 3 Current Slice Shipped" updated.

**Acceptance Checks.**

- `npm run test:integration` is green with `DATABASE_URL_TEST` configured.
- No new test relies on artificial timing; every race is forced via real concurrency
  primitives.
- No client-trusted totals appear in any new code path.
- Status docs updated; no contradictions with `STATUS.md`.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
DATABASE_URL_TEST="postgresql://..." npm run test:integration
npm run build
```

**Initiation Prompt.**

> You are continuing Phase 3 of Doopify, a developer-first self-hostable commerce
> engine. Read `STATUS.md`, `features-roadmap.md`, `HARDENING.md`, `PHASE_3_KICKOFF.md`,
> `PROJECT_INTENT.md`, and `CONTRIBUTING.md` before writing code. The current slice is
> "Phase 3A - Broader Real-DB Race And Idempotency Coverage" as defined in
> `PHASE_COMPLETION_PLAN.md`.
>
> The repo already has gated real-DB specs covering paid-checkout inventory decrement,
> duplicate payment-intent completion, competing duplicate completions, insufficient
> stock, and paid-only/idempotent discount usage. Extend that coverage to: concurrent
> checkout creation against the same variant near stock-out, conflicting webhook
> success/failure for the same payment intent, order-finalization-vs-email-failure
> ordering, discount usage cap under concurrent paid-order finalization, and late
> webhook delivery against an expired session. Force every race with real concurrency
> primitives, not artificial timing. When a test surfaces non-determinism, fix it in
> the service layer the same way the existing customer-creation race was fixed.
>
> Do not move logic client-side, do not weaken any invariant in
> `HARDENING.md > Payment And Checkout Invariants`, and do not change pricing rules.
> When done, update `STATUS.md > Phase 3 Current Slice Shipped` and the relevant
> `HARDENING.md` sections, then run the merge gate from
> `PHASE_COMPLETION_PLAN.md > Phase 3A > Verification Commands`.

### Phase 3B - Configurable Shipping Zones, Rates, And Jurisdiction-Aware Tax

**Intent.** Pricing already supports baseline destination-aware shipping zones and
tax through `src/server/checkout/pricing.ts`. This slice promotes those baselines into
configurable merchant-grade rules without moving any pricing authority client-side.

**In Scope.**

- A persisted, admin-editable shipping configuration (zones, rate strategies, weight
  or subtotal tiers) exposed through the existing settings or a new admin surface.
- A persisted, admin-editable tax configuration that supports jurisdiction overrides
  on top of the baseline.
- Centralized pricing service consumes the new config; no calculation moves to the
  client.
- Snapshot the shipping/tax decision into the persisted checkout snapshot so historical
  order truth survives later config changes.
- Fast tests covering a representative matrix of zones x rates x jurisdictions.

**Out Of Scope.**

- Real-time third-party tax APIs.
- Carrier integrations.
- Storefront UX for choosing shipping methods (that is Phase 3D).

**Deliverables.**

- Prisma migration(s) for shipping zones/rates and tax rules if not already modeled.
- Service module(s) under `src/server/checkout/` that own zone and tax resolution.
- Admin route(s) and UI for editing shipping/tax config.
- Updated pricing service that reads the new config.
- New unit tests in the fast Vitest harness.
- Updated `STATUS.md`, `features-roadmap.md`, and `HARDENING.md > Pricing Hardening
  Target`.

**Acceptance Checks.**

- A merchant can configure a new zone and rate from the admin and see the change
  reflected in `POST /api/checkout/create` totals on the next session.
- Pricing is identical for two checkout sessions with the same input.
- No client request payload can override the resolved shipping or tax line.
- Historical paid orders show the snapshot they were paid against, even after config
  changes.
- All verification commands green.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
DATABASE_URL_TEST="postgresql://..." npm run test:integration
npm run build
```

**Initiation Prompt.**

> You are executing "Phase 3B - Configurable Shipping Zones, Rates, And Jurisdiction-
> Aware Tax" as defined in `PHASE_COMPLETION_PLAN.md`. Read the canonical Doopify docs
> first: `STATUS.md`, `PROJECT_INTENT.md`, `features-roadmap.md`, `HARDENING.md`,
> `PHASE_3_KICKOFF.md`, `CONTRIBUTING.md`, and `AGENTS.md`.
>
> Today, baseline destination-aware shipping zones and tax rules already flow through
> `src/server/checkout/pricing.ts`. Promote them into configurable merchant-grade
> rules. Add Prisma models or extend existing ones for zones, rates, and jurisdiction
> overrides; back them with admin CRUD APIs and an admin editor surface; have the
> centralized pricing service resolve the new config; and snapshot the resolution into
> the persisted checkout snapshot so historical orders stay accurate after config
> changes. Add fast Vitest coverage for a representative zone x rate x jurisdiction
> matrix.
>
> Do not move calculations client-side, do not let request payloads override resolved
> lines, and do not regress any existing real-DB integration spec. When done, update
> `STATUS.md`, `features-roadmap.md > Phase 3 Current Slice Shipped`, and
> `HARDENING.md > Pricing Hardening Target`, then run the merge gate from
> `PHASE_COMPLETION_PLAN.md > Phase 3B > Verification Commands`.

### Phase 3C - Webhook Replay, Delivery Visibility, And Operational Audit Logs

**Intent.** Stripe webhook deliveries are durably logged with provider event id, type,
status, attempts, processed timestamp, last error, and payload hash. This slice turns
that log into a usable operational tool and adds audit logging around the highest-risk
admin actions.

**In Scope.**

- Admin route(s) and UI to list, filter, and inspect webhook deliveries.
- A guarded "replay" action that re-invokes the verified handler path against the
  stored payload, never re-fetching from the network.
- Idempotent replay - replaying a delivery for an already-finalized order must not
  duplicate orders, payments, inventory decrements, discount applications, or events.
- A new audit log table and consumer that records settings changes, payment events,
  fulfillment operations, and discount mutations with actor, target, and diff.
- Audit log surface in the admin (read-only).

**Out Of Scope.**

- Outbound merchant webhooks (that is Phase 4).
- Plugin-style retry policies (deferred to Phase 6).

**Deliverables.**

- Prisma migration for the audit log table.
- Service module(s) for replay and audit logging.
- Admin pages under `/admin` for delivery log and audit log.
- Permission checks ensuring replay and audit views are admin-only.
- Tests covering replay idempotency and audit-log emission for representative actions.
- Status docs updated.

**Acceptance Checks.**

- A failed delivery can be replayed from the admin and produces no duplicate side
  effects.
- Every settings change, payment event, fulfillment operation, and discount mutation
  emits an audit record.
- The replay path passes through the same handler that webhook delivery uses; no
  parallel "replay-only" code path exists.
- All verification commands green.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
DATABASE_URL_TEST="postgresql://..." npm run test:integration
npm run build
```

**Initiation Prompt.**

> You are executing "Phase 3C - Webhook Replay, Delivery Visibility, And Operational
> Audit Logs" as defined in `PHASE_COMPLETION_PLAN.md`. Start by reading the Doopify
> canonical docs: `STATUS.md`, `PROJECT_INTENT.md`, `features-roadmap.md`,
> `HARDENING.md`, `PHASE_3_KICKOFF.md`, `CONTRIBUTING.md`, and `AGENTS.md`.
>
> The repo already durably logs Stripe webhook deliveries with provider event id,
> type, status, attempts, processed timestamp, last error, and payload hash. Build the
> admin surface that lets an operator list, filter, and inspect those deliveries, plus
> a guarded replay action that re-runs the existing verified handler path against the
> stored payload and proves idempotent against already-finalized orders. Then add an
> audit log table, a consumer that records settings changes, payment events,
> fulfillment operations, and discount mutations with actor, target, and diff, and a
> read-only audit log admin surface.
>
> Replay must never re-fetch from Stripe; it must reuse the same handler the live
> webhook path uses. Do not introduce a parallel "replay-only" code path. Do not
> create outbound merchant webhooks here - that is Phase 4. Tests must cover replay
> idempotency and audit emission for at least one representative event in each of the
> four categories. When done, update `STATUS.md`, `HARDENING.md > Webhook Hardening
> Target`, and `features-roadmap.md > Phase 3 Current Slice Shipped`, then run the
> merge gate from `PHASE_COMPLETION_PLAN.md > Phase 3C > Verification Commands`.

### Phase 3D - Discount/Checkout UX Polish And Failure Surfaces

**Intent.** The pricing service correctly accepts code discounts and reports failure
states, but the storefront UX around rejected codes, stale carts, inactive products,
deleted variants, exhausted inventory, failed payments, and missing checkout sessions
is still thin. Close the loop so the demo and real merchant flows feel finished.

**In Scope.**

- Storefront `/checkout` surfaces clear, server-driven messaging for: rejected
  discount codes, expired/usage-capped codes, items removed from catalog, variants
  removed or out of stock, currency mismatches, and stale carts.
- Storefront `/checkout/success` and the polling flow surface failed and canceled
  payments without ambiguity.
- Empty-state designs for `/shop`, `/collections`, and individual collection pages
  with no published products.
- All copy, error codes, and field names come from the server response - no
  client-side fabrication of failure reasons.
- Vitest coverage for the new failure-message contract.

**Out Of Scope.**

- Brand theming (that is Phase 3E).
- Refund or return flows (that is Phase 4).

**Deliverables.**

- Updated checkout components and storefront pages.
- A typed failure-reason contract returned from the server.
- New tests in the fast Vitest harness for the contract.
- Status docs updated.

**Acceptance Checks.**

- A user with a typo'd discount code sees the server's rejection reason verbatim.
- A user whose cart contains a since-deleted variant cannot proceed and sees why.
- A user whose payment failed sees a non-ambiguous failed state on the success page.
- An empty collection renders an intentional empty state, not a broken grid.
- All verification commands green.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

**Initiation Prompt.**

> You are executing "Phase 3D - Discount/Checkout UX Polish And Failure Surfaces" from
> `PHASE_COMPLETION_PLAN.md`. Read the Doopify canonical docs first: `STATUS.md`,
> `PROJECT_INTENT.md`, `features-roadmap.md`, `HARDENING.md`, `PHASE_3_KICKOFF.md`,
> `CONTRIBUTING.md`, and `AGENTS.md`.
>
> The pricing service already returns correct totals and rejection reasons for
> discount codes, exhausted inventory, missing items, and other failure modes. The
> storefront surfaces are thin. Polish `/checkout`, `/checkout/success`, and the
> success-page polling flow so every server-reported failure (rejected code,
> expired/usage-capped code, removed catalog item, removed/out-of-stock variant,
> currency mismatch, stale cart, failed payment, canceled payment, missing session)
> renders a clear, server-driven message. Add intentional empty states to `/shop`,
> `/collections`, and individual collection pages.
>
> All failure copy and codes must come from the server response. Do not invent
> client-side failure reasons. Do not regress any pricing or webhook invariant. Add
> Vitest coverage for the failure-reason contract. When done, update `STATUS.md` and
> `features-roadmap.md > Phase 3 Current Slice Shipped`, then run the merge gate from
> `PHASE_COMPLETION_PLAN.md > Phase 3D > Verification Commands`.

### Phase 3E - Storefront Merchandising, Branding Tokens, And Operational Hardening

**Intent.** Make the storefront prove the developer-first story visually, and close
the remaining cross-cutting hardening items so Phase 3 can exit cleanly.

**In Scope.**

- Featured collections on the homepage driven by collection settings.
- Reusable storefront content blocks (hero, featured collections grid, product strip,
  collection strip) consumed by the homepage and shop.
- Branding tokens (color, type scale, logo, store name) sourced from the existing
  public storefront settings endpoint.
- Replace the in-memory rate limiter with a shared store suitable for multi-instance
  deployment (Redis or equivalent), behind an interface so tests can stub it.
- Review and normalize production Postgres SSL handling so production environments
  explicitly use `sslmode=verify-full` and the requirement is documented in `README.md`
  and `HARDENING.md`.
- Confirm collection assignment and merchandising APIs stay admin-only and storefront
  collection reads stay public/read-only via tests, not just convention.

**Out Of Scope.**

- Full theme directory packaging (deferred per `STATUS.md > Explicit Non-Goals`).
- Customer-account auth hardening (deferred until customer accounts exist).

**Deliverables.**

- New reusable storefront block components.
- Settings-driven branding token wiring.
- Shared rate-limit implementation plus tests.
- Documented production SSL normalization.
- Tests proving collection mutation routes reject non-admin sessions.
- Updated `STATUS.md`, `features-roadmap.md`, `HARDENING.md`, and `README.md`.

**Acceptance Checks.**

- A merchant can change a setting and see the storefront reflect it without redeploy.
- The rate limiter behaves correctly across two simulated instances in a test.
- Production environments documentably reject non-verified Postgres SSL.
- A non-admin session calling any collection mutation route receives the correct
  authorization error in tests.
- All verification commands green.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
DATABASE_URL_TEST="postgresql://..." npm run test:integration
npm run build
```

**Phase 3 Exit Trigger.** When 3A through 3E are all merged, mark Phase 3 complete
in `STATUS.md` and `features-roadmap.md`, and move the active phase pointer to
Phase 4.

**Initiation Prompt.**

> You are executing "Phase 3E - Storefront Merchandising, Branding Tokens, And
> Operational Hardening" from `PHASE_COMPLETION_PLAN.md`, the final slice of Phase 3
> for Doopify. Read the canonical docs first: `STATUS.md`, `PROJECT_INTENT.md`,
> `features-roadmap.md`, `HARDENING.md`, `PHASE_3_KICKOFF.md`, `CONTRIBUTING.md`, and
> `AGENTS.md`.
>
> Build featured-collection merchandising on the homepage driven by collection
> settings, plus reusable storefront content blocks (hero, featured collections grid,
> product strip, collection strip) that the homepage and `/shop` both consume. Wire
> branding tokens (color, type scale, logo, store name) from the existing public
> storefront settings endpoint into those blocks.
>
> Then close the cross-cutting hardening items: replace the in-memory rate limiter
> with a shared store behind an interface that tests can stub; normalize production
> Postgres SSL so it explicitly uses `sslmode=verify-full` and document the
> requirement in `README.md` and `HARDENING.md`; and add tests proving every
> collection mutation route rejects non-admin sessions.
>
> Do not package full theme directories - that is explicitly deferred. Do not touch
> customer-auth - customers do not have accounts yet. When all five Phase 3 slices
> (3A-3E) are merged, mark Phase 3 complete in `STATUS.md` and `features-roadmap.md`
> and move the active phase pointer to Phase 4. Run the merge gate from
> `PHASE_COMPLETION_PLAN.md > Phase 3E > Verification Commands`.

---

## Phase 4 - Merchant Lifecycle And Outbound Integrations

**Intent.** Phase 3 ends with merchant-grade pricing, replayable webhooks, audit logs,
and a polished storefront. Phase 4 finishes the end-to-end merchant lifecycle so
Doopify is credible for early real users: refunds and returns connected to payments
and inventory, outbound merchant webhooks for downstream systems, integration-specific
settings/secrets, transactional email observability, and analytics event fan-out.

**In Scope.**

- Refund flow connected to Stripe, payment records, order state, and inventory
  restocking, with admin UX.
- Return flow connected to refunds, with admin UX and a clear state machine.
- Outbound merchant webhooks: subscription model, signing, retry policy, dead-letter
  visibility, all built on top of the typed event dispatcher and static integration
  registry.
- Per-integration settings and secrets management (encrypted at rest, surfaced in the
  admin).
- Transactional email observability: delivery status, bounce/complaint handling,
  resend tooling.
- Analytics event fan-out using the existing event dispatcher.

**Out Of Scope.**

- Public plugin marketplace mechanics.
- Runtime filesystem plugin loading.
- Multi-tenant changes.

**Deliverables.**

- Prisma migrations for refund/return state, outbound webhook subscriptions, delivery
  attempts, integration secrets, and email delivery status.
- Service modules for each new domain.
- Admin surfaces for refund issuance, return processing, outbound webhook
  subscriptions, integration settings, and email delivery inspection.
- Tests covering: refund correctness against payments and inventory, return state
  transitions, outbound webhook retry/idempotency, secret encryption, email status
  transitions.
- Updated canonical docs.

**Acceptance Checks.**

- An admin can issue a partial or full refund and the order, payment, and inventory
  are consistent afterward.
- A return moves through its state machine and triggers a refund correctly.
- Outbound webhook deliveries are signed, retried with backoff, and visible in the
  admin.
- Integration secrets never appear unencrypted at rest.
- A bounced order confirmation email surfaces in the admin and can be resent without
  duplicating side effects.
- All verification commands green.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
DATABASE_URL_TEST="postgresql://..." npm run test:integration
npm run build
```

**Initiation Prompt.**

> You are starting Phase 4 of Doopify per `PHASE_COMPLETION_PLAN.md`. Confirm Phase 3
> is fully shipped in `STATUS.md` before beginning. Read the canonical docs first:
> `STATUS.md`, `PROJECT_INTENT.md`, `features-roadmap.md`, `HARDENING.md`,
> `CONTRIBUTING.md`, and `AGENTS.md`.
>
> Phase 4 finishes the end-to-end merchant lifecycle. Build, in this order: refunds
> connected to Stripe, payment records, order state, and inventory restocking, with
> admin UX; returns connected to refunds with a clear state machine; outbound
> merchant webhooks (subscriptions, signing, retry with backoff, dead-letter
> visibility) built on top of the existing typed event dispatcher and static
> integration registry; per-integration settings and secrets management with
> encryption at rest; transactional email observability with bounce/complaint
> handling and resend tooling; and analytics event fan-out through the dispatcher.
>
> Use Prisma as the single source of truth, keep route handlers thin, do not move
> any commerce logic client-side, and do not introduce runtime plugin loading or any
> marketplace mechanic - that is Phase 6. Tests must cover refund correctness against
> payments and inventory, return state transitions, outbound webhook retry/idempotency,
> secret encryption at rest, and email status transitions. Update `STATUS.md`,
> `features-roadmap.md`, `HARDENING.md`, and `README.md` when state changes. Run the
> merge gate from `PHASE_COMPLETION_PLAN.md > Phase 4 > Verification Commands`.

---

## Phase 5 - Platform Extraction

**Intent.** With a stable single-store commerce loop, extract the shared domain and
service logic into packages that a developer can consume without taking the entire
app, and add lightweight scaffolding tools. Doopify the app stays the proving ground.

**In Scope.**

- Move shared domain types, service interfaces, and pricing/checkout invariants into
  versioned internal packages.
- Introduce a thin SDK that lets external consumers call commerce services without
  reimplementing them.
- Provide a CLI or template tool that scaffolds new resources (route + service +
  Prisma fragment + DTO + test) following the existing conventions.
- Use code generation as scaffolding only, never as a replacement for the existing
  product, order, or checkout flows.

**Out Of Scope.**

- Public plugin marketplace.
- Runtime filesystem plugin loading.
- Replacing the handcrafted admin with generated CRUD UI.

**Deliverables.**

- Package layout (single-repo workspaces are fine; multi-repo is not required).
- Published-or-publishable SDK package consumed by the main app to validate it.
- A scaffolder CLI/template tool with at least one tested generator.
- Updated canonical docs reflecting the new architecture.

**Acceptance Checks.**

- The main Doopify app consumes the extracted packages and still passes the merge
  gate.
- A generated resource compiles, tests, and runs end-to-end without manual rework.
- No commerce-critical logic is duplicated between the app and the packages.
- All verification commands green.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
DATABASE_URL_TEST="postgresql://..." npm run test:integration
npm run build
```

**Initiation Prompt.**

> You are starting Phase 5 of Doopify per `PHASE_COMPLETION_PLAN.md`. Confirm Phase 4
> is fully shipped in `STATUS.md` before beginning. Read the canonical docs first:
> `STATUS.md`, `PROJECT_INTENT.md`, `features-roadmap.md`, `HARDENING.md`,
> `CONTRIBUTING.md`, and `AGENTS.md`.
>
> Phase 5 extracts platform pieces. Move shared domain types, service interfaces,
> pricing/checkout invariants, and event types into versioned internal packages, with
> the main Doopify app as the first consumer. Add a thin SDK package external
> consumers can use to call commerce services without reimplementing them. Add a
> scaffolder CLI or template tool that generates new resources (route + service +
> Prisma fragment + DTO + test) following the existing conventions, with at least one
> tested generator.
>
> Code generation is allowed only as scaffolding; do not regenerate or replace the
> existing product, order, checkout, collection, or admin flows. Do not start a public
> plugin marketplace - that is Phase 6. The merge gate must remain green with the main
> app consuming the extracted packages. Update `STATUS.md`, `features-roadmap.md`,
> `PROJECT_INTENT.md`, and `README.md` to reflect the new architecture. Run the merge
> gate from `PHASE_COMPLETION_PLAN.md > Phase 5 > Verification Commands`.

---

## Phase 6 - Public Plugin Platform

**Intent.** Only after Phases 3-5 prove out, open Doopify to third-party plugins as a
versioned, observable platform. This is the phase where marketplace claims become
defensible.

**In Scope.**

- Versioned plugin manifest format.
- Stable, supported event contract derived from the typed dispatcher built earlier.
- Settings schema and admin surfaces for third-party integrations.
- Compatibility and upgrade rules for plugin versions vs. core versions.
- Retry, replay, and observability story for failed plugin handlers (built on top of
  Phase 3C and Phase 4 outbound webhook infrastructure).
- Clear isolation model and ownership boundaries (process boundary, sandboxing
  posture, data access scopes).

**Out Of Scope.**

- Multi-tenant SaaS architecture (still a separate, later concern).
- Theme marketplace (still deferred until branding tokens and reusable blocks are
  fully settled).

**Deliverables.**

- Plugin manifest spec.
- Stable event contract document.
- Plugin settings/secrets admin surface.
- Plugin lifecycle (install, configure, upgrade, disable, uninstall).
- Plugin observability surface (errors, retries, replay).
- Public docs for plugin authors.

**Acceptance Checks.**

- A reference third-party plugin can be installed, configured, exercised end-to-end,
  upgraded, and uninstalled without corrupting any commerce data.
- Failed plugin handlers cannot block or corrupt order, payment, inventory, or
  fulfillment data.
- The event contract is versioned and a plugin built against version N runs unchanged
  on a future minor of the same major.
- All verification commands green.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
DATABASE_URL_TEST="postgresql://..." npm run test:integration
npm run build
```

**Initiation Prompt.**

> You are starting Phase 6 of Doopify per `PHASE_COMPLETION_PLAN.md`. Confirm Phase 5
> is fully shipped in `STATUS.md` before beginning. Read the canonical docs first:
> `STATUS.md`, `PROJECT_INTENT.md`, `features-roadmap.md`, `HARDENING.md`,
> `CONTRIBUTING.md`, and `AGENTS.md`.
>
> Phase 6 opens Doopify to third-party plugins. Define a versioned plugin manifest;
> derive a stable, supported event contract from the typed dispatcher already in
> place; build a plugin settings and secrets admin surface; implement the full plugin
> lifecycle (install, configure, upgrade, disable, uninstall); and build a plugin
> observability surface that reuses the Phase 3C webhook delivery log machinery and
> Phase 4 outbound webhook retry infrastructure. Define and enforce an isolation
> model so a failed plugin handler cannot block or corrupt order, payment, inventory,
> or fulfillment data.
>
> Do not start theme marketplace or multi-tenant work; both remain deferred. Ship a
> reference third-party plugin that exercises the full lifecycle end-to-end as part
> of the test surface. The event contract must be versioned such that a plugin built
> against version N runs unchanged on any future minor release of the same major.
> Update `STATUS.md`, `features-roadmap.md`, `PROJECT_INTENT.md > Launch Claim
> Discipline`, and `README.md` when ready. Run the merge gate from
> `PHASE_COMPLETION_PLAN.md > Phase 6 > Verification Commands`.

---

## Phase 7 - Launch Readiness

**Intent.** Phases 3-6 close the *product* gaps. Phase 7 closes the gap between "the
product is done" and "a stranger can run it in production safely." This work has
historically lived implicitly inside `LAUNCH_ROLLOUT.md > Launch Readiness Checklist`
and inside the deferred lists in `HARDENING.md`. Phase 7 lifts it into the same
sequenced shape the other phases use so launch-blocking work stops drifting.

Phase 7 is sliced into four parallel-friendly units (7A-7D), each owned by a different
skill domain. They can run concurrently after Phase 6 lands, or earlier if the launch
target is a narrower developer-first OSS release rather than a full production launch.

### Phase 7A - Infra, CI, Observability, And Production Operations

**Intent.** Make Doopify deployable, debuggable, and recoverable by someone who is not
the original author.

**In Scope.**

- CI pipeline that runs the full merge gate (`db:generate`, `tsc --noEmit`, `test`,
  `test:integration`, `build`) on every PR and on `main`.
- Reference deployment templates for at least one managed host (Vercel/Render/Fly) and
  one self-hosted path (Docker Compose with Postgres + the app).
- Local `docker-compose.yml` that gets a developer from `git clone` to a running
  Stripe-test checkout in under ten minutes.
- Production secrets management documented end-to-end (where keys live, how they
  rotate, what reads them at boot).
- Postgres connection pooling posture documented and tested for the multi-instance
  shape Phase 3E preps for.
- Backups, retention policy, and a written restore drill that has actually been
  executed once.
- Error tracking, log aggregation, APM, and uptime monitoring wired to production.
- Media binary storage moved off Postgres to object storage / CDN (called out as
  deferred in `HARDENING.md` and `STATUS.md`).
- A reference / demo deployment that prospects can click.

**Out Of Scope.**

- Multi-tenant deployment shapes.
- Region-failover / active-active topologies.
- Anything that requires re-architecting the commerce loop.

**Deliverables.**

- `.github/workflows/` (or equivalent) with the merge gate on PR + `main`.
- `docker-compose.yml` and a deployment README per supported target.
- Object storage adapter behind the existing media interface, plus migration path for
  existing Postgres-stored media.
- Documented runbooks for: deploy, rollback, restore-from-backup, rotate-secret,
  scale-up.
- Working demo site URL recorded in `README.md`.

**Acceptance Checks.**

- A new contributor follows the deployment README and has a running app within an
  hour without asking the author.
- The restore drill has been executed and documented with a real timestamp.
- A failed checkout in production is debuggable from the observability stack alone,
  without shelling into Postgres.
- Media is served from object storage in production; the Postgres `MediaAsset.data`
  path remains available for local dev only.
- All verification commands green.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
DATABASE_URL_TEST="postgresql://..." npm run test:integration
npm run build
```

**Initiation Prompt.**

> You are starting "Phase 7A - Infra, CI, Observability, And Production Operations"
> per `PHASE_COMPLETION_PLAN.md`. Read the canonical Doopify docs first: `STATUS.md`,
> `PROJECT_INTENT.md`, `features-roadmap.md`, `HARDENING.md`, `LAUNCH_ROLLOUT.md`,
> `CONTRIBUTING.md`, and `AGENTS.md`. Confirm Phase 6 is shipped (or that you are
> running 7A in parallel as part of an earlier launch target).
>
> Build CI that runs the full merge gate on every PR and on `main`. Add a
> `docker-compose.yml` that gets a developer from clone to a running Stripe-test
> checkout in under ten minutes, and reference deployment templates for at least one
> managed host and one self-hosted path. Move media binary storage off Postgres to
> object storage behind the existing media interface, with a migration path for
> existing assets. Document production secrets management, Postgres connection
> pooling, backups, restore drills (actually executed once), and runbooks for deploy,
> rollback, restore-from-backup, secret rotation, and scale-up. Wire error tracking,
> log aggregation, APM, and uptime monitoring to production. Stand up a demo
> deployment and record its URL in `README.md`.
>
> Do not change the commerce loop, do not introduce multi-tenant shapes, and do not
> regress any invariant in `HARDENING.md > Payment And Checkout Invariants`. When
> done, update `STATUS.md`, `HARDENING.md`, and `README.md`, then run the merge gate
> from `PHASE_COMPLETION_PLAN.md > Phase 7A > Verification Commands`.

### Phase 7B - Security, Compliance, And Legal Posture

**Intent.** Make Doopify safe to point at real money and real customer data, and make
the legal posture defensible.

**In Scope.**

- External security review or pen test of the checkout, webhook, and admin paths,
  with a remediated findings list.
- CSP and response-header hardening (deferred per `HARDENING.md`), including
  `Content-Security-Policy`, `Strict-Transport-Security`, `Referrer-Policy`,
  `X-Content-Type-Options`, and frame ancestors.
- PCI DSS SAQ-A self-assessment completed and filed (Stripe owns card data scope; the
  merchant still carries SAQ-A responsibilities).
- Privacy posture: privacy policy, terms of service, customer data export endpoint,
  customer data deletion endpoint, cookie consent banner if EU/UK/CA traffic is in
  scope.
- `security.txt` and a documented vulnerability disclosure channel.
- Admin MFA (TOTP at minimum); recovery codes and a recovery flow.
- Production Postgres SSL is `sslmode=verify-full` and tested - completes the work
  flagged in Phase 3E.
- Documented incident response process (who is paged, what gets recorded, how
  customers are notified).

**Out Of Scope.**

- SOC 2 / ISO 27001 audits (post-launch maturity work).
- Customer-account auth hardening if customer accounts have not been built yet -
  track separately.

**Deliverables.**

- Security review report and remediations merged.
- Header middleware enforced in `src/proxy.ts` or equivalent.
- SAQ-A document filed.
- `/privacy` and `/terms` storefront routes plus customer-data export and deletion
  endpoints.
- `security.txt` at `/.well-known/security.txt`.
- Admin MFA flows: enroll, challenge, recover.
- Updated `HARDENING.md`.

**Acceptance Checks.**

- The pen test report shows zero critical or high findings outstanding.
- A request without proper headers fails the new header policy in tests.
- A customer can request and receive their data export, and can request deletion that
  fully cascades through Prisma.
- An admin without MFA cannot log in once MFA is enforced (or can during a documented
  grace period that is configurable and time-bounded).
- All verification commands green.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
DATABASE_URL_TEST="postgresql://..." npm run test:integration
npm run build
```

**Initiation Prompt.**

> You are starting "Phase 7B - Security, Compliance, And Legal Posture" per
> `PHASE_COMPLETION_PLAN.md`. Read the canonical Doopify docs first: `STATUS.md`,
> `PROJECT_INTENT.md`, `features-roadmap.md`, `HARDENING.md`, `LAUNCH_ROLLOUT.md`,
> `CONTRIBUTING.md`, and `AGENTS.md`.
>
> Commission an external security review or pen test of the checkout, webhook, and
> admin paths, and remediate findings. Add CSP and response-header hardening
> (`Content-Security-Policy`, `Strict-Transport-Security`, `Referrer-Policy`,
> `X-Content-Type-Options`, frame ancestors) enforced in `src/proxy.ts` or equivalent.
> Complete the PCI DSS SAQ-A self-assessment. Stand up `/privacy`, `/terms`, a
> customer data export endpoint, a customer data deletion endpoint that cascades
> through Prisma, a cookie consent banner where required, and `security.txt` at
> `/.well-known/security.txt`. Implement admin MFA (TOTP minimum) with enroll,
> challenge, and recovery flows. Confirm production Postgres uses
> `sslmode=verify-full`, finishing the work flagged in Phase 3E. Document the
> incident response process.
>
> Do not start customer-account auth work if customer accounts have not been built;
> track separately. Do not pursue SOC 2 / ISO 27001 here. When done, update
> `STATUS.md`, `HARDENING.md`, `README.md`, and `LAUNCH_ROLLOUT.md > Strong Claims`
> if any new strong claim becomes defensible. Run the merge gate from
> `PHASE_COMPLETION_PLAN.md > Phase 7B > Verification Commands`.

### Phase 7C - Developer Experience, Documentation, And Community

**Intent.** Doopify's positioning is developer-first. A developer-first launch fails
if the docs, license, contribution path, and onboarding feel like an afterthought.

**In Scope.**

- Public documentation site generated from the existing `*.md` files (the canonical
  docs are good source material; they are not a docs site).
- Quickstart that takes a developer from `git clone` to a running Stripe-test
  checkout in under ten minutes (paired with the Phase 7A docker-compose work).
- Open-source license decision and `LICENSE` file at the repo root.
- `CHANGELOG.md` and a versioning/release policy. The Phase 6 stable event contract
  needs a public versioning story; this slice provides it.
- Contribution path: issue templates, PR template, code of conduct, DCO or CLA
  decision, contributor onboarding doc.
- Public support channel (GitHub Discussions, Discord, or equivalent) with a
  documented expectations bar.
- Plugin author documentation if Phase 6 has shipped.

**Out Of Scope.**

- Branded marketing site (separate from the docs site).
- Paid support tier mechanics.

**Deliverables.**

- Live docs site URL referenced in `README.md`.
- `LICENSE`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/`,
  `.github/PULL_REQUEST_TEMPLATE.md`.
- Versioning/release policy in `CONTRIBUTING.md` or a new `RELEASING.md`.
- Public support channel link in `README.md`.
- Plugin author guide (if Phase 6 shipped).

**Acceptance Checks.**

- A developer who has never seen the repo can follow the quickstart and reach a
  paid-test-checkout state without asking a maintainer.
- The license is unambiguous and matches the project's intent.
- A new release follows the documented version policy and produces a visible
  changelog entry.
- A first-time contributor can find issue templates, the PR template, and the code
  of conduct in one click from `README.md`.
- All verification commands green.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
npm run build
```

**Initiation Prompt.**

> You are starting "Phase 7C - Developer Experience, Documentation, And Community"
> per `PHASE_COMPLETION_PLAN.md`. Read the canonical Doopify docs first: `STATUS.md`,
> `PROJECT_INTENT.md`, `features-roadmap.md`, `HARDENING.md`, `LAUNCH_ROLLOUT.md`,
> `CONTRIBUTING.md`, and `AGENTS.md`.
>
> Stand up a public documentation site generated from the existing canonical `*.md`
> files. Add a quickstart that takes a developer from `git clone` to a running
> Stripe-test checkout in under ten minutes (use the Phase 7A docker-compose work).
> Add `LICENSE` at the repo root with a deliberate open-source license choice that
> matches the project's intent. Add `CHANGELOG.md` and a versioning/release policy in
> `CONTRIBUTING.md` or a new `RELEASING.md`; this is also the public versioning story
> Phase 6's stable event contract requires. Add `CODE_OF_CONDUCT.md`, issue templates,
> a PR template, a DCO-or-CLA decision, and a contributor onboarding doc. Stand up a
> public support channel and link it from `README.md`. If Phase 6 has shipped, add a
> plugin author guide.
>
> Do not build a separate marketing site or paid support mechanics here. When done,
> update `STATUS.md`, `README.md`, and any references in `LAUNCH_ROLLOUT.md`. Run the
> merge gate from `PHASE_COMPLETION_PLAN.md > Phase 7C > Verification Commands`.

### Phase 7D - Quality, Accessibility, And Performance

**Intent.** Prove the product holds up under real traffic, real assistive technology,
and real device variance before pointing prospects at it.

**In Scope.**

- Load test against the checkout/webhook path with realistic concurrency, capturing
  p50/p95/p99 and any failure modes.
- Accessibility audit of the storefront and admin against WCAG 2.2 AA, with findings
  remediated.
- Browser/device compatibility matrix tested for the storefront and admin.
- Performance budget for storefront pages (LCP, INP, CLS) with budgets enforced in
  CI where practical.
- SEO basics for the storefront: sitemap, `robots.txt`, structured data
  (Product, Offer, Organization), canonical tags, meta tags driven by settings.
- Decision on internationalization scope. If non-English-first merchants are in the
  launch target, scope locale, translations, and RTL handling here. If not, document
  the deferral explicitly.

**Out Of Scope.**

- Full i18n if it is not in the launch target - capture the decision but do not build
  it speculatively.
- Branded launch design refresh.

**Deliverables.**

- Load test report with documented thresholds and the regression-test entry that
  enforces them.
- Accessibility audit report with all critical and serious findings remediated.
- Browser/device support matrix in `README.md` or a new `SUPPORT.md`.
- Performance budgets enforced in CI for at least the homepage, shop, collection,
  product, and checkout pages.
- Storefront sitemap, robots, and structured data live.
- I18n decision captured in `STATUS.md > Explicit Non-Goals Right Now` or implemented.

**Acceptance Checks.**

- The load test passes the documented thresholds without surfacing any payment,
  inventory, or webhook-idempotency regression.
- A WCAG 2.2 AA scan returns zero critical or serious issues across the storefront
  and admin.
- The CI performance budget fails a PR that regresses LCP or INP on tracked pages.
- A search engine rendering of a product page exposes valid Product/Offer structured
  data.
- All verification commands green.

**Verification Commands.**

```bash
npm run db:generate
npx tsc --noEmit
npm run test
DATABASE_URL_TEST="postgresql://..." npm run test:integration
npm run build
```

**Initiation Prompt.**

> You are starting "Phase 7D - Quality, Accessibility, And Performance" per
> `PHASE_COMPLETION_PLAN.md`. Read the canonical Doopify docs first: `STATUS.md`,
> `PROJECT_INTENT.md`, `features-roadmap.md`, `HARDENING.md`, `LAUNCH_ROLLOUT.md`,
> `CONTRIBUTING.md`, and `AGENTS.md`.
>
> Run a load test against the checkout/webhook path with realistic concurrency,
> capture p50/p95/p99, and lock the thresholds in as a regression check that fails
> CI when breached. Run a WCAG 2.2 AA accessibility audit of the storefront and
> admin and remediate every critical and serious finding. Establish a browser/device
> support matrix and document it. Add storefront performance budgets (LCP, INP, CLS)
> enforced in CI for at least the homepage, shop, collection, product, and checkout
> pages. Add SEO basics: sitemap, `robots.txt`, structured data (Product, Offer,
> Organization), canonical tags, meta tags driven by settings. Decide whether
> internationalization is in the launch target; if it is, scope locale, translations,
> and RTL; if it is not, document the deferral explicitly in `STATUS.md > Explicit
> Non-Goals Right Now`.
>
> Do not regress any invariant in `HARDENING.md > Payment And Checkout Invariants`
> while load testing - any failure during load that breaks idempotency or inventory
> consistency is a launch blocker, not just a perf finding. When done, update
> `STATUS.md`, `HARDENING.md` if relevant, and `README.md`. Run the merge gate from
> `PHASE_COMPLETION_PLAN.md > Phase 7D > Verification Commands`.

**Phase 7 Exit Trigger.** When 7A through 7D are all merged and `LAUNCH_ROLLOUT.md >
Launch Readiness Checklist` is fully green, Doopify is launchable. Update
`STATUS.md` to reflect launch readiness, and switch the active phase pointer to
"post-launch maintenance" or to the next product phase you choose.

---

## Cross-Phase Reminders

- `STATUS.md` is the only place that says what is true now. Update it on every
  status-changing PR.
- Do not recreate `CLAUDE.md`. Use `AGENTS.md`.
- Money stays in integer minor units; the server stays the pricing authority; the
  browser never finalizes orders; verified Stripe webhook success does.
- Every initiation prompt above assumes the agent has not seen prior conversation,
  so it links back to this file and the canonical docs by name.

## Document Maintenance

When a phase ships, update `STATUS.md`, `features-roadmap.md`, and (where relevant)
`HARDENING.md` and `README.md`. This file (`PHASE_COMPLETION_PLAN.md`) should be kept
consistent with those updates; if a phase is restructured, edit the corresponding
section here in the same PR rather than letting it drift.
