# Doopify Developer Features Roadmap

> Archived on April 22, 2026.
> Historical reference only. The active strategy now lives in `features-roadmap.md`.

Purpose

This document defines the developer-facing roadmap for Doopify as it exists in this repo today.
The goal is not to restart foundation work. The goal is to turn the current app into a strong developer-first commerce product, then extract the reusable platform pieces once the product path is proven.

## Core Product Philosophy

- Prisma and Postgres remain the source of truth
- APIs and services own business logic
- money and inventory logic stay server-side
- explicit contracts beat magic generation
- extensible first, public platform second
- current app value comes before framework ambitions

## Current Foundation Already Shipped

These are not future ideas anymore. They already exist in the repo:

- Prisma-backed commerce schema and service layer
- Next.js App Router admin and storefront
- session-backed admin auth and route protection
- storefront catalog routes and cart flow
- checkout creation plus Stripe webhook reconciliation
- typed internal event dispatcher and static integration registry
- first-party email trigger on `order.paid`

That means the old "Foundation" phase is done enough to build on. We should not burn time re-planning schema, CRUD basics, or a fresh API architecture.

## Phase 1 - Productize The Current App

Focus: finish the most important merchant and developer outcomes inside this repo.

### Goals

- complete collections across admin and storefront
- improve shipping, tax, and discount handling in checkout
- harden customer, order, and fulfillment workflows
- add automated tests for the revenue path
- continue extracting business logic into services where route handlers still do too much

### Developer value

- clearer service boundaries
- more trustworthy end-to-end flows
- easier onboarding because the repo reflects a real product, not a partially generated scaffold

## Phase 2 - Integration-Ready Core

Focus: turn the existing event system into a stable internal extension surface.

### Goals

- expand typed internal events
- add outbound webhook subscriptions and delivery logs
- add first-party consumers for analytics, audit logs, and notifications
- add integration settings surfaces instead of hard-coded wiring

### Important rule

This phase is about internal and first-party integrations. It is not a public plugin marketplace yet.

## Phase 3 - Storefront Systemization

Focus: make the storefront more reusable without rushing into a theme marketplace.

### Goals

- standardize reusable storefront components
- move branding into settings and tokens
- support stronger content and merchandising surfaces
- keep theme packaging lightweight until the underlying component contracts are stable

## Phase 4 - Platform Extraction

Focus: extract proven pieces once the app has earned it.

### Likely outputs

- shared core packages for domain and services
- typed SDK for external consumers
- CLI or starter templates for new Doopify apps
- selective code generation for scaffolding new resources

### Guardrail

Generation should help with setup and repetition. It should not replace the repo's existing handcrafted admin and product flows.

## Phase 5 - Public Developer Platform

Focus: only after the earlier phases are stable.

### Requirements

- versioned plugin manifest
- stable event contracts
- compatibility rules
- retries and observability
- settings schema for integrations
- clear publishing and upgrade story

## What We Should Not Prioritize Yet

- redoing schema or API foundation work
- dynamic filesystem plugin loading in the app runtime
- replacing the current admin with generated CRUD screens
- marketing Doopify as a plugin marketplace before the contracts exist
- multi-tenant architecture before the single-store product flow is solid

## Marketing Position For This Repo

The right message for this codebase today is:

"A developer-first commerce engine with a real admin, real storefront, Stripe-ready checkout, and typed server-side extension seams."

The wrong message today is:

"A plugin marketplace, schema-generated app builder, or fully abstract multi-tenant platform."

## Definition Of Done

A developer feature is complete when:

- it works end to end in this repo
- it improves the current app rather than bypassing it
- it leaves behind a stable contract or reusable interface
- it reduces future setup or integration effort without hiding core behavior
