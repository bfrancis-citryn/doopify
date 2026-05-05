# Transactional Email Observability Plan

> Phase 4 implementation plan for delivery visibility, failure handling, and safe resend tooling.
>
> Created: April 28, 2026
> Status: planned next Phase 4 slice

## Goal

Make transactional email delivery observable and recoverable without creating duplicate commerce side effects.

The first target is order confirmation email delivery from the existing `order.paid` event consumer. The same model should later support fulfillment, refund, return, and customer-notification emails.

## Current Baseline

Already shipped:

- Typed internal event dispatcher in `src/server/events/dispatcher.ts`
- Static integration registry in `src/server/integrations/registry.ts`
- Order confirmation email consumer triggered by `order.paid`
- Revenue-path protection where email failure must not roll back order/payment/inventory commits
- Outbound webhook delivery observability and retry patterns that can guide email observability design

## Proposed Data Model

Add a durable email-delivery table, for example `EmailDelivery`.

Recommended fields:

- `id`
- `event` — internal event that requested the email, such as `order.paid`
- `template` — template key, such as `order_confirmation`
- `recipientEmail`
- `subject`
- `status` — `PENDING`, `SENT`, `FAILED`, `BOUNCED`, `COMPLAINED`, `RETRYING`, `RESEND_REQUESTED`
- `provider` — `smtp`, `resend`, `postmark`, etc.
- `providerMessageId`
- `attempts`
- `lastError`
- `nextRetryAt`
- `sentAt`
- `bouncedAt`
- `complainedAt`
- `createdAt`
- `updatedAt`
- optional relation fields, such as `orderId`, `customerId`, `refundId`, `returnId`

## Service Ownership

Create or extend a service layer, for example:

```txt
src/server/services/email-delivery.service.ts
```

The service should own:

- creating pending delivery records
- rendering/selecting the transactional template
- sending through the provider adapter
- updating sent/failed/bounced/complained status
- retry scheduling
- safe manual resend
- admin-safe DTOs for visibility

Route handlers should stay thin and call this service.

## Provider Adapter Boundary

Keep provider specifics behind a narrow adapter, for example:

```txt
src/server/email/provider.ts
```

The app should not spread provider-specific response parsing across route handlers or event consumers.

Adapter responsibilities:

- send email
- return provider message id
- normalize provider errors
- verify provider webhook signatures if bounce/complaint webhooks are added

## Admin UX

Add an admin observability surface that can show:

- recipient
- template
- related order/customer
- status
- provider message id
- attempts
- last error
- timestamps
- resend button for failed or bounced deliveries

Possible placement:

- Add an Email tab/page under admin observability, or
- Extend `/admin/webhooks` into a broader delivery-observability workspace if the UI remains clean.

## API Surface

Recommended private APIs:

```txt
GET  /api/email-deliveries
GET  /api/email-deliveries/[id]
POST /api/email-deliveries/[id]/resend
POST /api/webhooks/email-provider
```

The provider webhook route is optional for the first pass if no provider is wired yet, but the data model should be ready for bounce/complaint states.

## Safety Requirements

- Order/payment/inventory state must never depend on email provider success.
- Resending an email must not re-emit commerce side effects.
- A resend should create a new attempt or child delivery record, not mutate history in a way that loses the original failure.
- Raw provider errors should not leak secrets or full payloads to the browser.
- Email body content should be stored carefully; prefer metadata/status first and avoid persisting full customer-message bodies unless necessary.

## Automated Coverage

Fast tests should cover:

- successful send marks delivery `SENT`
- provider failure marks delivery `FAILED` without throwing back into order finalization
- resend only works for eligible statuses
- resend does not create duplicate order/payment/inventory side effects
- bounce/complaint webhook signature verification if provider webhooks are implemented
- admin list returns safe fields only

Real-DB tests should cover:

- paid-order finalization remains durable if email send fails
- resend creates a durable audit trail
- retries do not duplicate provider sends when a delivery is already sent

## First Implementation Slice

1. Add `EmailDeliveryStatus` enum and `EmailDelivery` model to Prisma.
2. Add `email-delivery.service.ts` with provider-adapter seams.
3. Update the order confirmation email consumer to create/update delivery records.
4. Add private list/detail/resend APIs.
5. Add an admin email-delivery view.
6. Add fast tests for success, failure, safe resend, and admin-safe DTOs.
7. Update `docs/STATUS.md`, `docs/features-roadmap.md`, and `docs/HARDENING.md` after the slice ships.

## Acceptance Check

This slice is complete when a failed or bounced order confirmation email is visible in the admin and can be resent without duplicating order, payment, inventory, discount, refund, return, webhook, or analytics side effects.
