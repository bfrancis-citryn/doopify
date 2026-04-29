import { err, ok } from '@/lib/api'
import { getJobRunnerSecret, isJobRunnerAuthorized } from '@/server/jobs/auth'
import { runDueJobs } from '@/server/jobs/job.service'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!getJobRunnerSecret()) {
    return err('Job runner secret is not configured', 503)
  }

  if (!isJobRunnerAuthorized(req)) {
    return err('Unauthorized', 401)
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || 25)))
  const workerId = searchParams.get('workerId') || undefined
  const result = await runDueJobs({ limit, workerId })

  return ok({
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
    skipped: result.skipped,
  })
}
