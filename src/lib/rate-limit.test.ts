import { beforeEach, describe, expect, it, vi } from 'vitest'

type SharedRow = {
  count: number
  expiresAt: Date
}

type UpdateManyArgs = {
  where: {
    key: string
    expiresAt?: {
      gt?: Date
      lte?: Date
    }
  }
  data: {
    count?: {
      increment: number
    }
    expiresAt?: Date
  }
}

type CreateArgs = {
  data: {
    key: string
    count: number
    expiresAt: Date
  }
}

type FindUniqueArgs = {
  where: {
    key: string
  }
}

type DeleteManyArgs = {
  where: {
    expiresAt: {
      lte: Date
    }
  }
}

const mocks = vi.hoisted(() => ({
  prisma: {
    rateLimitWindow: {
      updateMany: vi.fn<(_: UpdateManyArgs) => Promise<{ count: number }>>(),
      create: vi.fn<(_: CreateArgs) => Promise<SharedRow>>(),
      findUnique: vi.fn<(_: FindUniqueArgs) => Promise<SharedRow | null>>(),
      deleteMany: vi.fn<(_: DeleteManyArgs) => Promise<{ count: number }>>(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))

import { consumeRateLimit } from '@/lib/rate-limit'

function resetRateLimitGlobals() {
  const globalForRateLimit = globalThis as unknown as {
    doopifyRateLimitStore?: Map<string, { count: number; expiresAt: number }>
    doopifyRateLimitLastCleanupMs?: number
  }

  globalForRateLimit.doopifyRateLimitStore?.clear()
  globalForRateLimit.doopifyRateLimitLastCleanupMs = undefined
}

describe('consumeRateLimit', () => {
  beforeEach(() => {
    resetRateLimitGlobals()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv('NODE_ENV', 'test')

    mocks.prisma.rateLimitWindow.updateMany.mockResolvedValue({ count: 0 })
    mocks.prisma.rateLimitWindow.create.mockResolvedValue({
      count: 1,
      expiresAt: new Date(Date.now() + 1_000),
    })
    mocks.prisma.rateLimitWindow.findUnique.mockResolvedValue({
      count: 1,
      expiresAt: new Date(Date.now() + 1_000),
    })
    mocks.prisma.rateLimitWindow.deleteMany.mockResolvedValue({ count: 0 })
  })

  it('allows requests below limit', async () => {
    const key = `allowed:${Date.now()}`

    const first = await consumeRateLimit(key, { limit: 2, windowMs: 1_000 })
    const second = await consumeRateLimit(key, { limit: 2, windowMs: 1_000 })

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
    expect(second.remaining).toBe(0)
  })

  it('blocks requests over limit', async () => {
    const key = `blocked:${Date.now()}`

    await consumeRateLimit(key, { limit: 1, windowMs: 1_000 })
    const blocked = await consumeRateLimit(key, { limit: 1, windowMs: 1_000 })

    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('isolates keys', async () => {
    const keyA = `key-a:${Date.now()}`
    const keyB = `key-b:${Date.now()}`

    const firstA = await consumeRateLimit(keyA, { limit: 1, windowMs: 1_000 })
    const firstB = await consumeRateLimit(keyB, { limit: 1, windowMs: 1_000 })
    const secondA = await consumeRateLimit(keyA, { limit: 1, windowMs: 1_000 })

    expect(firstA.allowed).toBe(true)
    expect(firstB.allowed).toBe(true)
    expect(secondA.allowed).toBe(false)
  })

  it('falls back to memory when shared-store operations fail', async () => {
    vi.stubEnv('DOOPIFY_RATE_LIMIT_STORE', 'postgres')
    mocks.prisma.rateLimitWindow.updateMany.mockRejectedValue(new Error('db unavailable'))

    const key = `fallback:${Date.now()}`

    const first = await consumeRateLimit(key, { limit: 1, windowMs: 1_000 })
    const second = await consumeRateLimit(key, { limit: 1, windowMs: 1_000 })

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(false)
  })

  it('uses shared-store counters when configured for postgres', async () => {
    vi.stubEnv('DOOPIFY_RATE_LIMIT_STORE', 'postgres')

    const shared = new Map<string, SharedRow>()

    mocks.prisma.rateLimitWindow.deleteMany.mockImplementation(async ({ where }) => {
      let deleted = 0

      for (const [key, row] of shared.entries()) {
        if (row.expiresAt <= where.expiresAt.lte) {
          shared.delete(key)
          deleted += 1
        }
      }

      return { count: deleted }
    })

    mocks.prisma.rateLimitWindow.updateMany.mockImplementation(async ({ where, data }) => {
      const existing = shared.get(where.key)
      if (!existing) {
        return { count: 0 }
      }

      if (where.expiresAt?.gt) {
        if (existing.expiresAt <= where.expiresAt.gt) {
          return { count: 0 }
        }

        if (data.count?.increment) {
          existing.count += data.count.increment
        }

        return { count: 1 }
      }

      if (where.expiresAt?.lte) {
        if (existing.expiresAt > where.expiresAt.lte) {
          return { count: 0 }
        }

        existing.count = 1
        if (data.expiresAt) {
          existing.expiresAt = data.expiresAt
        }

        return { count: 1 }
      }

      return { count: 0 }
    })

    mocks.prisma.rateLimitWindow.create.mockImplementation(async ({ data }) => {
      if (shared.has(data.key)) {
        const uniqueError = new Error('unique') as Error & { code?: string }
        uniqueError.code = 'P2002'
        throw uniqueError
      }

      const created: SharedRow = {
        count: data.count,
        expiresAt: data.expiresAt,
      }

      shared.set(data.key, created)
      return created
    })

    mocks.prisma.rateLimitWindow.findUnique.mockImplementation(async ({ where }) => {
      const existing = shared.get(where.key)
      return existing ? { ...existing } : null
    })

    const key = `shared:${Date.now()}`

    const first = await consumeRateLimit(key, { limit: 2, windowMs: 1_000 })
    const second = await consumeRateLimit(key, { limit: 2, windowMs: 1_000 })
    const blocked = await consumeRateLimit(key, { limit: 2, windowMs: 1_000 })

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
    expect(blocked.allowed).toBe(false)
    expect(mocks.prisma.rateLimitWindow.updateMany).toHaveBeenCalled()
  })
})
