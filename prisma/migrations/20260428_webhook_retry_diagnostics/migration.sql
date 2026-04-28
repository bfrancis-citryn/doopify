ALTER TYPE "WebhookDeliveryStatus" ADD VALUE IF NOT EXISTS 'RETRY_PENDING';
ALTER TYPE "WebhookDeliveryStatus" ADD VALUE IF NOT EXISTS 'RETRY_EXHAUSTED';

ALTER TABLE "webhook_deliveries"
  ADD COLUMN "rawPayload" TEXT,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN "lastRetriedAt" TIMESTAMP(3);

CREATE INDEX "webhook_deliveries_status_nextRetryAt_idx" ON "webhook_deliveries"("status", "nextRetryAt");
