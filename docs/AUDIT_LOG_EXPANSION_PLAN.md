# Audit Log Expansion Plan

Documentation date: May 1, 2026

## Goal
Expand durable admin audit coverage for sensitive lifecycle operations without changing commerce behavior.

## Current State (Inspected)
- There is no dedicated generic `AuditLog` Prisma model/service in active runtime code.
- Existing durable action traces are primarily `OrderEvent` rows (`order_events`) written by order/refund/return/fulfillment services.
- `OrderEvent` coverage is useful for order timeline visibility, but currently lacks consistent actor identity (`actorId`) and structured before/after diffs.
- Non-order settings operations (integrations, provider credentials, outbound webhook manual retry, email resend) do not currently write a durable admin audit entry.

## Proposed Audit Contract (for next implementation PR)
Use a single structured audit writer (service helper) with this minimum shape:
- `actor`: `{ actorType, actorId, actorEmail, actorRole }`
- `action`: stable machine key (examples below)
- `resource`: `{ type, id }`
- `summary`: short human-readable line
- `diff`: JSON object with `before` and `after` where applicable
- `snapshot`: JSON object for one-sided events (retry triggered, resend requested)
- `redactions`: list of fields redacted in stored payload
- `occurredAt`

Recommendation:
- Keep `OrderEvent` timeline writes for merchant UX.
- Add a dedicated generic audit store for non-order resources and for richer structured payloads.

## Gap Inventory

### 1) Integration Changes
- Current coverage: No durable audit entry for create/update/delete in `settings/integrations` APIs.
- Actor: `OWNER` or `STAFF` from `requireAdmin`.
- Actions:
  - `integration.created`
  - `integration.updated`
  - `integration.deleted`
  - `integration.events.updated`
  - `integration.secrets.updated`
- Resource: `Integration:{integrationId}`
- Diff/snapshot fields:
  - `name`, `type`, `status`, `webhookUrl` (normalized), selected `events[]`
  - secret keys changed (`addedKeys`, `updatedKeys`, `removedKeys`) only
- Redact:
  - `webhookSecret`
  - all `IntegrationSecret.value`
  - decrypted custom header values (`HEADER_*`)
- Tests needed:
  - Route tests for create/update/delete assert audit call fired once with actor/resource/action.
  - Redaction test asserts secret values never persist in audit payload.

### 2) Webhook Manual Retries
- Current coverage: Delivery status updates exist; no explicit admin-action audit for manual retry trigger.
- Actor: `OWNER`/`STAFF` from `requireAdmin`.
- Actions:
  - `outbound_webhook.retry_requested`
  - `outbound_webhook.retry_rejected` (not retryable/not found)
- Resource: `OutboundWebhookDelivery:{deliveryId}`
- Diff/snapshot fields:
  - prior `status`, `attempts`, `nextRetryAt`
  - retry trigger timestamp
  - post-retry status summary when available
- Redact:
  - outbound `payload` body
  - sensitive response body fragments if they include tokens/secrets
- Tests needed:
  - `route.test.ts` for retry endpoint to verify audit write on success and non-retryable path.
  - Service test for payload minimization/redaction.

### 3) Email Resends
- Current coverage: resend logic exists with new delivery creation; no explicit admin-action audit event.
- Actor: `OWNER`/`STAFF` from `requireAdmin`.
- Actions:
  - `email_delivery.resend_requested`
  - `email_delivery.resend_blocked` (policy disallowed)
  - `email_delivery.resend_created` (new delivery id linked)
- Resource: `EmailDelivery:{originalDeliveryId}`
- Diff/snapshot fields:
  - original delivery `status`, `template`, `recipientEmail`
  - resend outcome and `newDeliveryId` when created
- Redact:
  - full HTML email body
  - provider credentials/message transport secrets
- Tests needed:
  - resend route/service tests assert audit write for success + blocked attempts.
  - test that audit stores ids/status/template, not rendered email HTML.

### 4) Refund Creation
- Current coverage: `OrderEvent` entry (`refund.issued`) exists.
- Gap: missing actor identity, structured refund intent snapshot, and explicit failed-attempt audit.
- Actor: `OWNER`/`STAFF` from authenticated admin mutation route.
- Actions:
  - `refund.created_pending`
  - `refund.issued`
  - `refund.failed_provider`
- Resource: `Refund:{refundId}` and `Order:{orderId}` link
- Diff/snapshot fields:
  - `amountCents`, `reason`, `restockItems`, item list summary
  - payment status before/after, order payment status before/after
  - idempotency key fingerprint (safe form only)
- Redact:
  - raw Stripe error payloads if they contain sensitive request details
  - any provider secret material
- Tests needed:
  - refund service test verifies success + provider-failure audit paths.
  - assert failure path audit does not imply inventory/order mutation.

### 5) Return State Changes
- Current coverage: `OrderEvent` entries exist for return requested and status transitions.
- Gap: missing actor identity and structured transition diff.
- Actor: `OWNER`/`STAFF` (or `SYSTEM` only where truly automated).
- Actions:
  - `return.created`
  - `return.status_changed`
  - `return.closed_with_refund`
- Resource: `Return:{returnId}`
- Diff/snapshot fields:
  - `fromStatus` -> `toStatus`
  - changed `reason`, `note`, `receivedAt`
  - linked `refundId` when present
- Redact:
  - free-form note content if marked internal-only (store redaction marker)
- Tests needed:
  - return service tests assert transition audit payload includes from/to status and actor.
  - close-with-refund path test asserts cross-link fields.

### 6) Shipping Label Purchase
- Current coverage: `OrderEvent` (`SHIPPING_LABEL_PURCHASED`) exists on success.
- Gap: missing actor identity, structured cost/provider snapshot, and explicit failure audit.
- Actor: `OWNER`/`STAFF`.
- Actions:
  - `shipping_label.purchase_requested`
  - `shipping_label.purchased`
  - `shipping_label.purchase_failed`
- Resource: `ShippingLabel:{shippingLabelId}` (or `Order:{orderId}` for failed pre-create)
- Diff/snapshot fields:
  - provider, carrier, service, providerRateId
  - `rateAmountCents`, `labelAmountCents`, currency
  - tracking number presence flag
- Redact:
  - full provider raw response
  - provider credentials/tokens
- Tests needed:
  - shipping-label service tests for success and provider failure audit writes.
  - verify audit contains pricing snapshot, not raw provider payload.

### 7) Payment/Fulfillment Quick Actions
- Current coverage: `OrderEvent` entries exist (`PAYMENT_STATUS_UPDATED`, `FULFILLMENT_STATUS_UPDATED`).
- Gap: missing actor identity and explicit before/after values.
- Actor: `OWNER`/`STAFF`.
- Actions:
  - `order.payment_status_changed`
  - `order.fulfillment_status_changed`
- Resource: `Order:{orderId}`
- Diff/snapshot fields:
  - `paymentStatus`: from -> to
  - `fulfillmentStatus`: from -> to
  - request source (`quick_action`)
- Redact:
  - none beyond standard PII minimization
- Tests needed:
  - order status route/service tests assert from/to diff capture and actor linkage.

### 8) Provider Credential Changes
- Current coverage: credential writes/deletes occur in provider and shipping connection services; no durable admin audit row.
- Actor: `OWNER` for provider gateway routes, `OWNER`/`STAFF` for shipping connect/disconnect routes.
- Actions:
  - `provider.credentials_saved`
  - `provider.credentials_cleared`
  - `provider.verified`
  - `provider.verification_failed`
  - `provider.disconnected`
- Resource: `Provider:{provider}` and `Integration:{integrationId}` when known
- Diff/snapshot fields:
  - provider name/category
  - credential key presence changes only (`addedKeys`, `updatedKeys`, `removedKeys`)
  - verification state before/after and safe error summary
- Redact:
  - all credential values (`API_KEY`, `SECRET_KEY`, `PASSWORD`, `WEBHOOK_SECRET`, etc.)
  - SMTP usernames can be masked, not full raw value
- Tests needed:
  - provider credentials/verify/disconnect route tests assert audit actions.
  - service tests confirm zero secret-value leakage in audit payload.

## Likely Files For The Next Implementation PR
- Schema and shared service:
  - `prisma/schema.prisma`
  - `src/server/services/*audit*.ts` (new shared audit writer)
- Integration/provider mutation paths:
  - `src/app/api/settings/integrations/route.ts`
  - `src/app/api/settings/integrations/[id]/route.ts`
  - `src/app/api/settings/providers/[provider]/credentials/route.ts`
  - `src/app/api/settings/providers/[provider]/verify/route.ts`
  - `src/app/api/settings/providers/[provider]/route.ts`
  - `src/server/services/provider-connection.service.ts`
  - `src/server/shipping/shipping-provider.service.ts`
- Lifecycle mutation paths:
  - `src/app/api/outbound-webhook-deliveries/[id]/retry/route.ts`
  - `src/server/services/outbound-webhook.service.ts`
  - `src/app/api/email-deliveries/[id]/resend/route.ts`
  - `src/server/services/email-delivery.service.ts`
  - `src/server/services/order-adjustments.service.ts`
  - `src/server/services/refund.service.ts`
  - `src/server/services/return.service.ts`
  - `src/server/shipping/shipping-label.service.ts`
  - `src/app/api/orders/[orderNumber]/status/route.ts`
  - `src/server/services/order.service.ts`

## Suggested Rollout Order
1. Add shared audit contract + schema + redaction utilities.
2. Add non-order admin action coverage first (integrations/providers/webhook retry/email resend).
3. Enrich order lifecycle operations (refund/return/label/status actions) with actor + structured diff.
4. Expand tests route-by-route and service-by-service with explicit redaction assertions.

