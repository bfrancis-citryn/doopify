ALTER TABLE "users"
  ADD COLUMN "mfaTotpSecretEnc" TEXT,
  ADD COLUMN "mfaTotpPendingSecretEnc" TEXT,
  ADD COLUMN "mfaEnabledAt" TIMESTAMP(3),
  ADD COLUMN "mfaRecoveryCodesHash" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "mfaGracePeriodEndsAt" TIMESTAMP(3);

CREATE TABLE "mfa_login_challenges" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_login_challenges_userId_expiresAt_idx" ON "mfa_login_challenges"("userId", "expiresAt");
CREATE INDEX "mfa_login_challenges_expiresAt_idx" ON "mfa_login_challenges"("expiresAt");

ALTER TABLE "mfa_login_challenges"
  ADD CONSTRAINT "mfa_login_challenges_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
