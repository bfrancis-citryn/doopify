import { prisma } from '@/lib/prisma'

const DEFAULT_RUNNER_NAME = 'jobs-runner'

export type JobRunnerHeartbeatView = {
  runnerName: string
  lastStartedAt: Date | null
  lastSucceededAt: Date | null
  lastFailedAt: Date | null
  lastErrorSummary: string | null
  lastDurationMs: number | null
  lastSeenAt: Date | null
  health: 'healthy' | 'failing' | 'idle'
}

function normalizeRunnerName(runnerName: string | undefined) {
  const trimmed = runnerName?.trim()
  if (!trimmed) return DEFAULT_RUNNER_NAME
  return trimmed.slice(0, 120)
}

function normalizeErrorSummary(error: unknown) {
  const summary = error instanceof Error ? error.message : 'Unknown job runner failure'
  return summary.slice(0, 4000)
}

function getLastSeenAt(heartbeat: {
  lastStartedAt: Date | null
  lastSucceededAt: Date | null
  lastFailedAt: Date | null
}) {
  const values = [heartbeat.lastStartedAt, heartbeat.lastSucceededAt, heartbeat.lastFailedAt].filter(
    (value): value is Date => Boolean(value)
  )

  if (values.length === 0) return null
  return values.sort((a, b) => b.getTime() - a.getTime())[0]
}

function toHeartbeatView(heartbeat: {
  runnerName: string
  lastStartedAt: Date | null
  lastSucceededAt: Date | null
  lastFailedAt: Date | null
  lastErrorSummary: string | null
  lastDurationMs: number | null
}) {
  const lastSeenAt = getLastSeenAt(heartbeat)
  const failedAfterSuccess =
    heartbeat.lastFailedAt &&
    (!heartbeat.lastSucceededAt || heartbeat.lastFailedAt.getTime() > heartbeat.lastSucceededAt.getTime())

  return {
    runnerName: heartbeat.runnerName,
    lastStartedAt: heartbeat.lastStartedAt,
    lastSucceededAt: heartbeat.lastSucceededAt,
    lastFailedAt: heartbeat.lastFailedAt,
    lastErrorSummary: heartbeat.lastErrorSummary,
    lastDurationMs: heartbeat.lastDurationMs,
    lastSeenAt,
    health: failedAfterSuccess ? 'failing' : heartbeat.lastSucceededAt ? 'healthy' : 'idle',
  } satisfies JobRunnerHeartbeatView
}

export async function recordJobRunnerStart(runnerName: string | undefined, startedAt: Date) {
  const name = normalizeRunnerName(runnerName)

  return prisma.jobRunnerHeartbeat.upsert({
    where: { runnerName: name },
    create: {
      runnerName: name,
      lastStartedAt: startedAt,
    },
    update: {
      lastStartedAt: startedAt,
    },
  })
}

export async function recordJobRunnerSuccess(
  runnerName: string | undefined,
  {
    startedAt,
    finishedAt,
  }: {
    startedAt: Date
    finishedAt: Date
  }
) {
  const name = normalizeRunnerName(runnerName)
  const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime())

  return prisma.jobRunnerHeartbeat.upsert({
    where: { runnerName: name },
    create: {
      runnerName: name,
      lastStartedAt: startedAt,
      lastSucceededAt: finishedAt,
      lastDurationMs: durationMs,
      lastErrorSummary: null,
    },
    update: {
      lastStartedAt: startedAt,
      lastSucceededAt: finishedAt,
      lastDurationMs: durationMs,
      lastErrorSummary: null,
    },
  })
}

export async function recordJobRunnerFailure(
  runnerName: string | undefined,
  {
    startedAt,
    finishedAt,
    error,
  }: {
    startedAt: Date
    finishedAt: Date
    error: unknown
  }
) {
  const name = normalizeRunnerName(runnerName)
  const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime())

  return prisma.jobRunnerHeartbeat.upsert({
    where: { runnerName: name },
    create: {
      runnerName: name,
      lastStartedAt: startedAt,
      lastFailedAt: finishedAt,
      lastErrorSummary: normalizeErrorSummary(error),
      lastDurationMs: durationMs,
    },
    update: {
      lastStartedAt: startedAt,
      lastFailedAt: finishedAt,
      lastErrorSummary: normalizeErrorSummary(error),
      lastDurationMs: durationMs,
    },
  })
}

export async function listJobRunnerHeartbeats() {
  const rows = await prisma.jobRunnerHeartbeat.findMany({
    orderBy: [{ updatedAt: 'desc' }, { runnerName: 'asc' }],
  })

  return rows.map((row) =>
    toHeartbeatView({
      runnerName: row.runnerName,
      lastStartedAt: row.lastStartedAt,
      lastSucceededAt: row.lastSucceededAt,
      lastFailedAt: row.lastFailedAt,
      lastErrorSummary: row.lastErrorSummary,
      lastDurationMs: row.lastDurationMs,
    })
  )
}
