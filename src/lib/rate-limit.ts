import { prisma } from '@/lib/prisma'

type WindowState = {
  count: number
  expiresAt: number
}

const globalForRateLimit = globalThis as unknown as {
  doopifyRateLimitStore?: Map<string, WindowState>
  doopifyRateLimitLastCleanupMs?: number
}

const store = globalForRateLimit.doopifyRateLimitStore ?? new Map<string, WindowState>()
const SHARED_STORE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000

if (!globalForRateLimit.doopifyRateLimitStore) {
  globalForRateLimit.doopifyRateLimitStore = store
}

function shouldUseSharedRateLimitStore() {
  const preferredStore = process.env.DOOPIFY_RATE_LIMIT_STORE?.trim().toLowerCase()

  if (preferredStore === 'memory') {
    return false
  }

  if (preferredStore === 'postgres') {
    return true
  }

  return process.env.NODE_ENV === 'production'
}

function consumeInMemoryRateLimit(
  key: string,
  {
    limit,
    windowMs,
  }: {
    limit: number
    windowMs: number
  }
) {
  const now = Date.now()

  for (const [entryKey, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(entryKey)
    }
  }

  const current = store.get(key)
  if (!current || current.expiresAt <= now) {
    const next = { count: 1, expiresAt: now + windowMs }
    store.set(key, next)
    return {
      allowed: true,
      remaining: Math.max(0, limit - next.count),
      retryAfterMs: windowMs,
    }
  }

  current.count += 1
  store.set(key, current)

  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    retryAfterMs: Math.max(0, current.expiresAt - now),
  }
}

async function cleanupExpiredSharedWindows(now: Date) {
  const nowMs = now.getTime()
  const lastCleanupMs = globalForRateLimit.doopifyRateLimitLastCleanupMs ?? 0

  if (lastCleanupMs && nowMs - lastCleanupMs < SHARED_STORE_CLEANUP_INTERVAL_MS) {
    return
  }

  globalForRateLimit.doopifyRateLimitLastCleanupMs = nowMs

  await prisma.rateLimitWindow.deleteMany({
    where: {
      expiresAt: {
        lte: now,
      },
    },
  })
}

function isPrismaUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
  )
}

async function consumeSharedRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  createRetriesRemaining = 1
) {
  const now = new Date()
  const windowExpiresAt = new Date(now.getTime() + windowMs)

  await cleanupExpiredSharedWindows(now)

  const incrementedActiveWindow = await prisma.rateLimitWindow.updateMany({
    where: {
      key,
      expiresAt: {
        gt: now,
      },
    },
    data: {
      count: {
        increment: 1,
      },
    },
  })

  if (incrementedActiveWindow.count === 0) {
    const resetExpiredWindow = await prisma.rateLimitWindow.updateMany({
      where: {
        key,
        expiresAt: {
          lte: now,
        },
      },
      data: {
        count: 1,
        expiresAt: windowExpiresAt,
      },
    })

    if (resetExpiredWindow.count === 0) {
      try {
        await prisma.rateLimitWindow.create({
          data: {
            key,
            count: 1,
            expiresAt: windowExpiresAt,
          },
        })
      } catch (error) {
        if (!isPrismaUniqueConstraintError(error) || createRetriesRemaining <= 0) {
          throw error
        }

        return consumeSharedRateLimit(key, { limit, windowMs }, createRetriesRemaining - 1)
      }
    }
  }

  const windowState = await prisma.rateLimitWindow.findUnique({
    where: { key },
    select: {
      count: true,
      expiresAt: true,
    },
  })

  if (!windowState) {
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterMs: windowMs,
    }
  }

  return {
    allowed: windowState.count <= limit,
    remaining: Math.max(0, limit - windowState.count),
    retryAfterMs: Math.max(0, windowState.expiresAt.getTime() - Date.now()),
  }
}

export async function consumeRateLimit(
  key: string,
  {
    limit,
    windowMs,
  }: {
    limit: number
    windowMs: number
  }
) {
  if (!shouldUseSharedRateLimitStore()) {
    return consumeInMemoryRateLimit(key, { limit, windowMs })
  }

  try {
    return await consumeSharedRateLimit(key, { limit, windowMs })
  } catch {
    return consumeInMemoryRateLimit(key, { limit, windowMs })
  }
}
