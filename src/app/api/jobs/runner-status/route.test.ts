import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listJobRunnerHeartbeats: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/jobs/job-runner-heartbeat.service', () => ({
  listJobRunnerHeartbeats: mocks.listJobRunnerHeartbeats,
}))

import { GET } from './route'

describe('GET /api/jobs/runner-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'admin_1', email: 'admin@example.com', role: 'OWNER' },
    })
    mocks.listJobRunnerHeartbeats.mockResolvedValue([
      {
        runnerName: 'vercel-cron',
        lastStartedAt: new Date('2026-05-01T12:00:00.000Z'),
        lastSucceededAt: new Date('2026-05-01T12:00:04.000Z'),
        lastFailedAt: null,
        lastErrorSummary: null,
        lastDurationMs: 4000,
        lastSeenAt: new Date('2026-05-01T12:00:04.000Z'),
        health: 'healthy',
      },
    ])
  })

  it('returns admin-safe runner heartbeat visibility', async () => {
    const response = await GET(new Request('http://localhost/api/jobs/runner-status'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.runners).toHaveLength(1)
    expect(json.data.runners[0]).toMatchObject({
      runnerName: 'vercel-cron',
      health: 'healthy',
      lastDurationMs: 4000,
    })
    expect(mocks.listJobRunnerHeartbeats).toHaveBeenCalled()
  })
})
