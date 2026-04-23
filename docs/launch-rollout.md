# Launch Rollout

This document keeps the product story, launch messaging, and rollout sequencing aligned with what the repo actually does.

## Positioning

Doopify should currently be presented as:

**A developer-first commerce engine with a real admin, real storefront, Stripe-backed checkout, and typed server-side extension seams.**

That message is strongest when we lead with shipped proof:

- real product and media management
- storefront catalog and checkout flow
- webhook-first payment finalization
- typed internal events and first-party integrations
- self-hostable Prisma and Postgres foundation

## What Phase 3 Adds To The Story

Phase 3 improves the launch narrative in four visible ways:

- collections make merchandising tangible
- storefront upgrades make screenshots and demos more compelling
- pricing hardening makes checkout claims more trustworthy
- automated coverage makes the revenue path easier to defend during launch

## Audience

Primary launch audience:

- developers building a custom storefront without wanting Shopify lock-in
- technical founders who want source access and operational control
- product-minded teams that care about extensibility but still need a usable app today

Secondary audience:

- agencies or consultants who want a codebase they can extend for clients

## Messaging Pillars

### 1. Real Product, Not Just Platform Ambition

Lead with the fact that the repo already ships a working admin, storefront, checkout path, and event seams.

### 2. Developer-First Without Being Abstract

Emphasize that Prisma, APIs, services, and explicit contracts are part of a usable product, not just a framework pitch.

### 3. Extensible Without Overclaiming

Talk about typed internal events and integration-ready architecture.
Do not market a public plugin ecosystem until the contracts, manifest, and operational model exist.

### 4. Merchant-Ready Direction

Phase 3 should make it clear that the product is moving toward stronger merchandising and launch readiness, not just backend architecture.

## Claims To Avoid

Avoid these until they are genuinely shipped:

- plugin marketplace
- public app ecosystem
- theme marketplace
- multi-tenant SaaS platform
- fully automated schema-generated admin

## Launch Asset Priorities

### Product proof

- collection-driven homepage or merch section
- storefront collection browse flow
- checkout success path
- admin collection management flow

### Technical proof

- architecture diagram showing checkout plus webhook finalization
- event and integration story at a high level
- clear setup instructions in `README.md`

### Messaging proof

- short product description
- launch bullets for what is shipped now
- list of intentionally deferred capabilities so messaging stays honest

## Suggested Rollout Sequence

1. Finish core Phase 3 collection and merchandising work
2. Harden checkout pricing behavior and tests
3. Refresh screenshots and demo path around collections plus checkout
4. Update launch copy to reflect only shipped capabilities
5. Publish technical content that explains the developer-first architecture in plain language

## Core Launch Copy

### Short version

Doopify is a developer-first commerce engine with a real admin, storefront, Stripe-backed checkout, and typed server-side extension seams.

### Expanded version

Doopify gives developers a self-hostable commerce codebase built on Next.js, Prisma, and PostgreSQL. It includes a real admin, a real storefront, webhook-first payment finalization, and explicit service boundaries that are easier to extend than closed platforms.

## Current Proof Checklist

Before pushing launch messaging harder, we should be able to demo:

- product browsing
- product detail
- add to cart
- checkout creation
- Stripe-backed payment reconciliation
- order success state
- collection browsing
- at least one collection-driven merchandising surface

If any of those are missing, the product story should stay narrower until they land.
