CREATE TABLE IF NOT EXISTS "job_runner_heartbeats" (
  "runnerName" TEXT NOT NULL,
  "lastStartedAt" TIMESTAMP(3),
  "lastSucceededAt" TIMESTAMP(3),
  "lastFailedAt" TIMESTAMP(3),
  "lastErrorSummary" TEXT,
  "lastDurationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_runner_heartbeats_pkey" PRIMARY KEY ("runnerName")
);

CREATE INDEX IF NOT EXISTS "job_runner_heartbeats_updatedAt_idx"
  ON "job_runner_heartbeats"("updatedAt");
