import { z } from 'zod'

import { err, ok } from '@/lib/api'
import { requireAdmin } from '@/server/auth/require-auth'
import { getJobs } from '@/server/jobs/job.service'

export const runtime = 'nodejs'

const statusSchema = z.enum([
  'ALL',
  'PENDING',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'RETRYING',
  'EXHAUSTED',
  'CANCELLED',
])

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value ?? '')
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.floor(parsed)
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = statusSchema.safeParse(searchParams.get('status') ?? 'ALL')
    if (!status.success) {
      return err('Invalid job status filter', 400)
    }

    const jobs = await getJobs({
      status: status.data,
      type: searchParams.get('type') ?? undefined,
      page: parseNumber(searchParams.get('page'), 1),
      pageSize: Math.min(100, parseNumber(searchParams.get('pageSize'), 20)),
    })

    return ok(jobs)
  } catch (error) {
    console.error('[GET /api/jobs]', error)
    return err('Failed to fetch jobs', 500)
  }
}
