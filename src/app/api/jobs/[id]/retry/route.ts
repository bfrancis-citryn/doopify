import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { retryJob } from '@/server/jobs/job.service'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) {
    return auth.response
  }

  try {
    const { id } = await params
    const job = await retryJob(id)
    if (!job) {
      return err('Job not found or not retryable', 404)
    }

    return ok(job)
  } catch (error) {
    console.error('[POST /api/jobs/[id]/retry]', error)
    return err('Failed to retry job', 500)
  }
}
