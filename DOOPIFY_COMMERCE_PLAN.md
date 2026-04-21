# Doopify Commerce Plan

## Goal

Operate Doopify as one shared commerce platform where:

- the public storefront reads the live catalog
- the admin writes and manages the live catalog and operations data
- future customer account pages reuse the same order and customer records

The system should keep moving away from mock/demo behavior and toward real, persistent commerce behavior.

## What The Repo Already Supports

### Shared commerce core

Both admin and storefront are already reading from the same Prisma/Postgres model for core catalog data.

Implemented now:

- protected admin auth/session flow
- persisted products, variants, options, and media
- persisted customers, discounts, settings, analytics, and orders
- storefront product listing and detail reads
- dedicated media library with SEO metadata editing

### Admin surfaces currently in scope

- orders
- draft orders
- products
- media
- customers
- discounts
- analytics
- settings

### Storefront surfaces currently in scope

- homepage
- product listing at `/shop`
- product detail at `/shop/[handle]`
- cart drawer shell

## Current Commerce Data Flow

### Catalog flow

1. Staff edits products in admin.
2. Product data persists via Prisma services and API routes.
3. Media assets and product gallery links persist in the same data model.
4. Storefront product APIs revalidate.
5. Storefront pages read the updated catalog.

### Operations flow

1. Staff views and updates orders in admin.
2. Status changes and fulfillments persist in the database.
3. Analytics and customer views can read from the same underlying records.

## Current Missing Flow

The missing commerce loop is still checkout.

What is not done yet:

- customer checkout route
- Stripe payment intent creation
- webhook-based order creation
- inventory decrement from live checkout
- order confirmation email

That means catalog publishing works, but revenue flow is not complete yet.

## Route Structure

### Admin routes

- `/orders`
- `/orders/[orderNumber]`
- `/draft-orders`
- `/products`
- `/media`
- `/customers`
- `/discounts`
- `/analytics`
- `/settings`

### Storefront routes

- `/`
- `/shop`
- `/shop/[handle]`

### Planned next storefront routes

- `/checkout`
- `/collections/[handle]`
- `/account`
- `/account/orders/[orderNumber]`

## Recommended Product Direction

### Keep using one source of truth

- Prisma remains the only persistence layer
- thin route handlers
- domain logic in service modules
- storefront and admin consume the same model instead of parallel fake layers

### Keep the media model centralized

The new media library should remain the canonical place to manage:

- uploads
- alt text
- asset reuse
- product attachment visibility

Later, the storage backend can evolve without changing the admin workflow.

## Recommended Next Delivery Order

1. Finish Stripe checkout and webhook order creation.
2. Add DB-backed draft order persistence.
3. Add collection management and collection storefront routes.
4. Add customer account and post-purchase views.
5. Add email and production hardening.

## Guiding Principle

Every new feature should reinforce one shared commerce core:

- routeable records
- real persistence
- reusable services
- shared admin/storefront data
- realistic fulfillment, payment, and media workflows

