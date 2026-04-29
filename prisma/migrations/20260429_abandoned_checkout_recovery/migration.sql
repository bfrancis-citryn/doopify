ALTER TABLE "checkout_sessions"
  ADD COLUMN "abandonedAt" TIMESTAMP(3),
  ADD COLUMN "recoveryToken" TEXT,
  ADD COLUMN "recoveryEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "recoveryEmailCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recoveredAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "checkout_sessions_recoveryToken_key" ON "checkout_sessions"("recoveryToken");
CREATE INDEX "checkout_sessions_status_createdAt_idx" ON "checkout_sessions"("status", "createdAt");
CREATE INDEX "checkout_sessions_abandonedAt_idx" ON "checkout_sessions"("abandonedAt");
CREATE INDEX "checkout_sessions_recoveryToken_idx" ON "checkout_sessions"("recoveryToken");
CREATE INDEX "checkout_sessions_recoveryEmailSentAt_idx" ON "checkout_sessions"("recoveryEmailSentAt");
