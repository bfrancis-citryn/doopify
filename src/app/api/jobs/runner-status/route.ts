import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { listJobRunnerHeartbeats } from '@/server/jobs/job-runner-heartbeat.service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) {
    return auth.response
  }

  try {
    const runners = await listJobRunnerHeartbeats()
    return ok({ runners })
  } catch (error) {
    console.error('[GET /api/jobs/runner-status]', error)
    return err('Failed to fetch job runner status', 500)
  }
}
