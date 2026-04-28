-- Phase 4: Expand Refund and Return models with item-level detail, Stripe idempotency, and state tracking

-- RefundStatus enum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'ISSUED', 'FAILED');

-- Expand refunds table
ALTER TABLE "refunds"
  ADD COLUMN "stripe_refund_id" TEXT UNIQUE,
  ADD COLUMN "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "restock_items" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- RefundItem table
CREATE TABLE "refund_items" (
  "id"           TEXT NOT NULL,
  "refund_id"    TEXT NOT NULL,
  "order_item_id" TEXT NOT NULL,
  "variant_id"   TEXT,
  "quantity"     INTEGER NOT NULL,
  "amount"       DOUBLE PRECISION NOT NULL,
  CONSTRAINT "refund_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "refund_items_refund_id_idx" ON "refund_items"("refund_id");
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_refund_id_fkey"
  FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Expand returns table
ALTER TABLE "returns"
  ADD COLUMN "refund_id" TEXT UNIQUE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_refund_id_fkey"
  FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReturnItem table
CREATE TABLE "return_items" (
  "id"           TEXT NOT NULL,
  "return_id"    TEXT NOT NULL,
  "order_item_id" TEXT NOT NULL,
  "variant_id"   TEXT,
  "quantity"     INTEGER NOT NULL,
  "reason"       TEXT,
  CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "return_items_return_id_idx" ON "return_items"("return_id");
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_fkey"
  FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
