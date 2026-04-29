CREATE TABLE "analytics_events" (
  "id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "orderId" TEXT,
  "refundId" TEXT,
  "returnId" TEXT,
  "deliveryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_event_occurredAt_idx" ON "analytics_events"("event", "occurredAt");
CREATE INDEX "analytics_events_orderId_idx" ON "analytics_events"("orderId");
CREATE INDEX "analytics_events_refundId_idx" ON "analytics_events"("refundId");
CREATE INDEX "analytics_events_returnId_idx" ON "analytics_events"("returnId");
CREATE INDEX "analytics_events_deliveryId_idx" ON "analytics_events"("deliveryId");
