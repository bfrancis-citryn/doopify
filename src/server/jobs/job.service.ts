import type { Job, JobStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_RUN_LIMIT = 25
const MAX_RUN_LIMIT = 100
const BASE_RETRY_DELAY_MS = 60 * 1000
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000

const DUE_JOB_STATUSES: JobStatus[] = ['PENDING', 'RETRYING']

const SENSITIVE_KEY_PATTERN = /secret|token|password|authorization|api[-_]?key|signature/i

export type EnqueueJobOptions = {
  runAt?: Date
  maxAttempts?: number
}

export type ClaimDueJobsOptions = {
  workerId?: string
  now?: Date
}

export type RunJobOptions = {
  workerId?: string
  now?: Date
  skipClaim?: boolean
}

export type RunDueJobsOptions = {
  limit?: number
  workerId?: string
  now?: Date
}

export type GetJobsFilters = {
  status?: JobStatus | 'ALL'
  type?: string
  page?: number
  pageSize?: number
}

export type SafeJob = Omit<Job, 'payload'> & {
  payload: unknown
}

export type JobRunResult = {
  processed: boolean
  success: boolean
  job: SafeJob | null
  error?: string
  skippedReason?: 'NOT_FOUND' | 'NOT_DUE' | 'NOT_CLAIMED'
}

function clampLimit(limit: number | undefined) {
  if (!limit) return DEFAULT_RUN_LIMIT
  return Math.max(1, Math.min(MAX_RUN_LIMIT, limit))
}

function getWorkerId(workerId: string | undefined) {
  if (workerId) return workerId
  return `worker:${process.pid}:${Math.random().toString(36).slice(2, 10)}`
}

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Job processing failed'
  return message.slice(0, 4000)
}

function calculateRetryRunAt(attempt: number, now = new Date()) {
  const delayMs = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, attempt - 1)))
  return new Date(now.getTime() + delayMs)
}

function sanitizeJobPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map((value) => sanitizeJobPayload(value))
  }

  if (!payload || typeof payload !== 'object') {
    return payload
  }

  const objectPayload = payload as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(objectPayload)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]'
      continue
    }

    sanitized[key] = sanitizeJobPayload(value)
  }

  return sanitized
}

function toSafeJob(job: Job): SafeJob {
  return {
    ...job,
    payload: sanitizeJobPayload(job.payload),
  }
}

function dueJobsWhere(now: Date): Prisma.JobWhereInput {
  return {
    status: { in: DUE_JOB_STATUSES },
    runAt: { lte: now },
    lockedAt: null,
  }
}

export async function enqueueJob(type: string, payload: Prisma.InputJsonValue, options: EnqueueJobOptions = {}) {
  return prisma.job.create({
    data: {
      type,
      payload,
      status: 'PENDING',
      maxAttempts: Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS),
      runAt: options.runAt ?? new Date(),
    },
  })
}

export async function claimDueJobs(limit = DEFAULT_RUN_LIMIT, options: ClaimDueJobsOptions = {}) {
  const now = options.now ?? new Date()
  const workerId = getWorkerId(options.workerId)
  const dueJobs = await prisma.job.findMany({
    where: dueJobsWhere(now),
    select: { id: true },
    orderBy: [{ runAt: 'asc' }, { createdAt: 'asc' }],
    take: clampLimit(limit),
  })

  const claimedJobs: Job[] = []
  for (const dueJob of dueJobs) {
    const claimed = await prisma.job.updateMany({
      where: {
        id: dueJob.id,
        ...dueJobsWhere(now),
      },
      data: {
        status: 'RUNNING',
        lockedAt: now,
        lockedBy: workerId,
      },
    })

    if (claimed.count === 0) {
      continue
    }

    const job = await prisma.job.findUnique({
      where: { id: dueJob.id },
    })

    if (job) {
      claimedJobs.push(job)
    }
  }

  return claimedJobs
}

export async function markJobSuccess(jobId: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'SUCCESS',
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  })
}

export async function markJobFailed(jobId: string, error: unknown) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      attempts: { increment: 1 },
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: normalizeError(error),
    },
  })
}

export async function scheduleRetry(jobId: string, error: unknown) {
  const now = new Date()
  const existing = await prisma.job.findUnique({
    where: { id: jobId },
    select: { attempts: true, maxAttempts: true },
  })

  if (!existing) {
    return null
  }

  const nextAttempts = existing.attempts + 1
  const shouldExhaust = nextAttempts >= existing.maxAttempts
  return prisma.job.update({
    where: { id: jobId },
    data: shouldExhaust
      ? {
          status: 'EXHAUSTED',
          attempts: { increment: 1 },
          processedAt: now,
          lockedAt: null,
          lockedBy: null,
          runAt: now,
          lastError: normalizeError(error),
        }
      : {
          status: 'RETRYING',
          attempts: { increment: 1 },
          processedAt: null,
          lockedAt: null,
          lockedBy: null,
          runAt: calculateRetryRunAt(nextAttempts, now),
          lastError: normalizeError(error),
        },
  })
}

export async function runJob(jobId: string, options: RunJobOptions = {}): Promise<JobRunResult> {
  const now = options.now ?? new Date()
  const workerId = getWorkerId(options.workerId)

  if (!options.skipClaim) {
    const claimed = await prisma.job.updateMany({
      where: {
        id: jobId,
        ...dueJobsWhere(now),
      },
      data: {
        status: 'RUNNING',
        lockedAt: now,
        lockedBy: workerId,
      },
    })

    if (claimed.count === 0) {
      const existing = await prisma.job.findUnique({ where: { id: jobId } })
      if (!existing) {
        return {
          processed: false,
          success: false,
          job: null,
          skippedReason: 'NOT_FOUND',
        }
      }
      return {
        processed: false,
        success: false,
        job: toSafeJob(existing),
        skippedReason: 'NOT_CLAIMED',
      }
    }
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } })
  if (!job) {
    return {
      processed: false,
      success: false,
      job: null,
      skippedReason: 'NOT_FOUND',
    }
  }

  if (job.status !== 'RUNNING') {
    return {
      processed: false,
      success: false,
      job: toSafeJob(job),
      skippedReason: 'NOT_DUE',
    }
  }

  const { getJobHandler } = await import('@/server/jobs/registry')
  const handler = getJobHandler(job.type)
  if (!handler) {
    const failed = await markJobFailed(job.id, new Error(`No handler registered for job type: ${job.type}`))
    return {
      processed: true,
      success: false,
      job: toSafeJob(failed),
      error: failed.lastError ?? 'Unknown job handler error',
    }
  }

  try {
    await handler(job.payload, { jobId: job.id })
    const success = await markJobSuccess(job.id)
    return {
      processed: true,
      success: true,
      job: toSafeJob(success),
    }
  } catch (error) {
    const retried = await scheduleRetry(job.id, error)
    const failedJob = retried ?? (await markJobFailed(job.id, error))
    return {
      processed: true,
      success: false,
      job: toSafeJob(failedJob),
      error: normalizeError(error),
    }
  }
}

export async function runDueJobs(options: RunDueJobsOptions = {}) {
  const now = options.now ?? new Date()
  const claimedJobs = await claimDueJobs(options.limit, {
    workerId: options.workerId,
    now,
  })

  const results: JobRunResult[] = []
  for (const claimedJob of claimedJobs) {
    results.push(
      await runJob(claimedJob.id, {
        workerId: options.workerId,
        now,
        skipClaim: true,
      })
    )
  }

  return {
    processed: claimedJobs.length,
    succeeded: results.filter((result) => result.success).length,
    failed: results.filter((result) => result.processed && !result.success).length,
    skipped: results.filter((result) => !result.processed).length,
    results,
  }
}

export async function getJobs(filters: GetJobsFilters = {}) {
  const page = Math.max(1, Math.floor(filters.page ?? 1))
  const pageSize = Math.max(1, Math.min(100, Math.floor(filters.pageSize ?? 20)))
  const where: Prisma.JobWhereInput = {
    ...(filters.status && filters.status !== 'ALL' ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  }

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: [{ runAt: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return {
    jobs: jobs.map(toSafeJob),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getJob(id: string) {
  const job = await prisma.job.findUnique({
    where: { id },
  })

  return job ? toSafeJob(job) : null
}

export async function retryJob(id: string) {
  const retried = await prisma.job.updateMany({
    where: {
      id,
      status: { in: ['FAILED', 'EXHAUSTED', 'CANCELLED', 'RETRYING'] },
    },
    data: {
      status: 'PENDING',
      runAt: new Date(),
      processedAt: null,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  })

  if (retried.count === 0) return null
  return getJob(id)
}

export async function cancelJob(id: string) {
  const cancelled = await prisma.job.updateMany({
    where: {
      id,
      status: { in: ['PENDING', 'RETRYING', 'RUNNING', 'FAILED'] },
    },
    data: {
      status: 'CANCELLED',
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  })

  if (cancelled.count === 0) return null
  return getJob(id)
}
