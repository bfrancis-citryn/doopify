import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    jobRunnerHeartbeat: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

import {
  listJobRunnerHeartbeats,
  recordJobRunnerFailure,
  recordJobRunnerStart,
  recordJobRunnerSuccess,
} from './job-runner-heartbeat.service'

describe('job runner heartbeat service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.jobRunnerHeartbeat.upsert.mockResolvedValue({})
    mocks.prisma.jobRunnerHeartbeat.findMany.mockResolvedValue([])
  })

  it('records successful heartbeat updates with duration and clear error summary', async () => {
    const startedAt = new Date('2026-05-01T12:00:00.000Z')
    const finishedAt = new Date('2026-05-01T12:00:05.250Z')

    await recordJobRunnerStart('vercel-cron', startedAt)
    await recordJobRunnerSuccess('vercel-cron', { startedAt, finishedAt })

    expect(mocks.prisma.jobRunnerHeartbeat.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { runnerName: 'vercel-cron' },
        update: expect.objectContaining({
          lastStartedAt: startedAt,
        }),
      })
    )
    expect(mocks.prisma.jobRunnerHeartbeat.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { runnerName: 'vercel-cron' },
        update: expect.objectContaining({
          lastStartedAt: startedAt,
          lastSucceededAt: finishedAt,
          lastDurationMs: 5250,
          lastErrorSummary: null,
        }),
      })
    )
  })

  it('records failed heartbeat updates with error summary', async () => {
    const startedAt = new Date('2026-05-01T12:00:00.000Z')
    const finishedAt = new Date('2026-05-01T12:00:02.000Z')

    await recordJobRunnerFailure('external-worker', {
      startedAt,
      finishedAt,
      error: new Error('network timeout while calling handler'),
    })

    expect(mocks.prisma.jobRunnerHeartbeat.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { runnerName: 'external-worker' },
        update: expect.objectContaining({
          lastFailedAt: finishedAt,
          lastDurationMs: 2000,
          lastErrorSummary: 'network timeout while calling handler',
        }),
      })
    )
  })

  it('returns admin-safe heartbeat views', async () => {
    mocks.prisma.jobRunnerHeartbeat.findMany.mockResolvedValue([
      {
        runnerName: 'runner-a',
        lastStartedAt: new Date('2026-05-01T12:00:00.000Z'),
        lastSucceededAt: new Date('2026-05-01T12:00:03.000Z'),
        lastFailedAt: null,
        lastErrorSummary: null,
        lastDurationMs: 3000,
      },
      {
        runnerName: 'runner-b',
        lastStartedAt: new Date('2026-05-01T12:10:00.000Z'),
        lastSucceededAt: new Date('2026-05-01T12:09:00.000Z'),
        lastFailedAt: new Date('2026-05-01T12:11:00.000Z'),
        lastErrorSummary: 'boom',
        lastDurationMs: 1000,
      },
    ])

    const rows = await listJobRunnerHeartbeats()

    expect(rows[0]).toMatchObject({
      runnerName: 'runner-a',
      health: 'healthy',
      lastDurationMs: 3000,
    })
    expect(rows[1]).toMatchObject({
      runnerName: 'runner-b',
      health: 'failing',
      lastErrorSummary: 'boom',
    })
  })
})
