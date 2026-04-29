import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runDueJobs: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  env: {
    JOB_RUNNER_SECRET: 'job-runner-secret-value',
    WEBHOOK_RETRY_SECRET: 'webhook-retry-secret-value',
  },
}))

vi.mock('@/server/jobs/job.service', () => ({
  runDueJobs: mocks.runDueJobs,
}))

import { POST } from './route'

describe('POST /api/jobs/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runDueJobs.mockResolvedValue({
      processed: 3,
      succeeded: 2,
      failed: 1,
      skipped: 0,
      results: [],
    })
  })

  it('requires a runner secret', async () => {
    const response = await POST(new Request('http://localhost/api/jobs/run', { method: 'POST' }))

    expect(response.status).toBe(401)
    expect(mocks.runDueJobs).not.toHaveBeenCalled()
  })

  it('runs due jobs when authorized', async () => {
    const response = await POST(
      new Request('http://localhost/api/jobs/run?limit=15&workerId=cron-worker', {
        method: 'POST',
        headers: {
          authorization: 'Bearer job-runner-secret-value',
        },
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.runDueJobs).toHaveBeenCalledWith({
      limit: 15,
      workerId: 'cron-worker',
    })
  })
})
