import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  storeCount: vi.fn(),
  userCount: vi.fn(),
  findStore: vi.fn(),
  disconnect: vi.fn(),
  existsSync: vi.fn(),
}))

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class PrismaPg {},
}))

vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {
    store = {
      count: mocks.storeCount,
      findFirst: mocks.findStore,
    }

    user = {
      count: mocks.userCount,
    }

    $queryRawUnsafe = mocks.queryRaw
    $disconnect = mocks.disconnect
  },
}))

vi.mock('node:fs', () => ({
  default: {
    existsSync: mocks.existsSync,
  },
}))

import { GET } from './route'

describe('GET /api/setup/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.queryRaw.mockResolvedValue([{ '?column?': 1 }])
    mocks.storeCount.mockResolvedValue(1)
    mocks.userCount.mockResolvedValue(1)
    mocks.findStore.mockResolvedValue({
      id: 'store_1',
      name: 'Doopify Store',
      email: 'owner@example.com',
    })
    mocks.disconnect.mockResolvedValue(undefined)
    mocks.existsSync.mockReturnValue(true)

    process.env.DATABASE_URL = 'postgresql://db_user:super-secret-password@localhost:5432/doopify'
    process.env.JWT_SECRET = 'super-strong-jwt-secret-that-should-never-leak'
    process.env.STRIPE_SECRET_KEY = 'sk_test_secret_should_not_leak'
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_public'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_secret_should_not_leak'
    process.env.WEBHOOK_RETRY_SECRET = 'retry-secret-should-not-leak'
    process.env.RESEND_API_KEY = 're_api_secret_should_not_leak'
    process.env.RESEND_WEBHOOK_SECRET = 're_whsec_secret_should_not_leak'
    process.env.NEXT_PUBLIC_STORE_URL = 'https://shop.example.com'
    process.env.VERCEL_URL = 'example.vercel.app'
  })

  it('returns safe setup diagnostics with no raw secrets', async () => {
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toEqual(
      expect.objectContaining({
        overallStatus: expect.any(String),
        completionPercent: expect.any(Number),
        requiredChecks: expect.any(Array),
        recommendedChecks: expect.any(Array),
        warnings: expect.any(Array),
        safeNextActions: expect.any(Array),
        categories: expect.any(Array),
      })
    )

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('super-strong-jwt-secret-that-should-never-leak')
    expect(serialized).not.toContain('sk_test_secret_should_not_leak')
    expect(serialized).not.toContain('whsec_secret_should_not_leak')
    expect(serialized).not.toContain('retry-secret-should-not-leak')
    expect(serialized).not.toContain('re_api_secret_should_not_leak')
    expect(serialized).not.toContain('re_whsec_secret_should_not_leak')
    expect(serialized).not.toContain('super-secret-password')
  })
})
