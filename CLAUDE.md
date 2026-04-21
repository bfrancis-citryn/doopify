# Doopify Repo Brief

## Overview

Doopify is a headless commerce platform built in Next.js with:

- a protected admin application
- a storefront catalog
- Prisma as the data model source of truth
- PostgreSQL as persistence

This repo is no longer just a UI prototype. Core admin/catalog/media functionality is now connected to real backend routes and database-backed services.

## Current Repo State

### Implemented

- Prisma commerce schema with products, variants, media, customers, orders, discounts, settings, sessions, payments, fulfillments, refunds, and returns
- JWT-based admin login/logout/me flow
- private admin route protection via `src/proxy.ts`
- DB-backed admin APIs for products, orders, customers, discounts, analytics, settings, and media
- storefront product listing and product detail reads
- product editor persistence and product-to-storefront sync
- standalone media library with upload, alt text editing, deletion, and linked-product visibility

### Still missing

- Stripe checkout and webhook order creation
- DB-backed draft orders
- collection management and collection storefront routes
- customer account pages
- transactional email
- role-based permission hardening and rate limiting

## Core Objectives

Prioritize:

1. building reusable service-backed features, not demo-only UI
2. keeping Prisma as the single source of truth
3. maintaining clean separation between UI, route handlers, and service logic
4. shipping end-to-end flows before polishing secondary visuals

## Tech Stack

- Frontend: Next.js App Router
- Backend: Next.js route handlers
- ORM: Prisma
- Database: PostgreSQL
- Auth: JWT cookie sessions
- Payments: Stripe is planned, not implemented yet

## System Architecture

### Frontend and admin

Responsibilities:

- render storefront and admin UI
- fetch data through route handlers or shared service-backed routes
- keep UI state local, but treat the database as the source of truth

Rules:

- do not access the database directly from UI code
- prefer server-backed reads/writes over parallel fake state
- keep components modular

### Backend API

Responsibilities:

- validation
- auth/session checks
- business logic orchestration
- persistence through Prisma

Rules:

- all DB access goes through Prisma
- route handlers stay thin
- service modules own business logic

### Database

Prisma remains the source of truth for:

- catalog
- media
- customers
- orders
- settings
- sessions

## Recommended Build Order From Here

### Phase 1

- Stripe checkout route
- PaymentIntent creation
- webhook-based order creation
- inventory decrement on successful payment

### Phase 2

- draft order persistence
- collection authoring and collection storefront pages

### Phase 3

- transactional email
- customer accounts
- role-based auth hardening

## Coding Standards

- prefer TypeScript for new backend/shared code
- avoid bypassing Prisma
- keep API responses consistent:

```json
{
  "success": true,
  "data": {}
}
```

or

```json
{
  "success": false,
  "error": "Message"
}
```

## Definition Of Done

A feature is complete when:

- it works end-to-end from DB to API to UI
- it handles errors cleanly
- it survives refresh/navigation
- it follows the existing service and Prisma architecture

