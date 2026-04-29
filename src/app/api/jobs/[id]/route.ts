import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { getJob } from '@/server/jobs/job.service'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) {
    return auth.response
  }

  try {
    const { id } = await params
    const job = await getJob(id)
    if (!job) {
      return err('Job not found', 404)
    }

    return ok(job)
  } catch (error) {
    console.error('[GET /api/jobs/[id]]', error)
    return err('Failed to fetch job', 500)
  }
}
