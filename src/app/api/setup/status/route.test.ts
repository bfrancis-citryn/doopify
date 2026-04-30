import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
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

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

import { GET } from './route'

describe('GET /api/setup/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'staff_1', email: 'staff@example.com', role: 'STAFF' },
    })

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

  it('returns JSON auth errors for unauthenticated users', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const response = await GET(new Request('http://localhost/api/setup/status'))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(payload).toEqual({ success: false, error: 'Unauthorized' })
    expect(mocks.queryRaw).not.toHaveBeenCalled()
  })

  it('returns JSON auth errors for forbidden users', async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    })

    const response = await GET(new Request('http://localhost/api/setup/status'))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(payload).toEqual({ success: false, error: 'Forbidden' })
    expect(mocks.queryRaw).not.toHaveBeenCalled()
  })

  it('returns safe setup diagnostics with no raw secrets', async () => {
    const response = await GET(new Request('http://localhost/api/setup/status'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toEqual(
      expect.objectContaining({
        checks: expect.any(Array),
        passCount: expect.any(Number),
        warnCount: expect.any(Number),
        failCount: expect.any(Number),
        requiredFailCount: expect.any(Number),
        ok: expect.any(Boolean),
        overallStatus: expect.any(String),
        completionPercent: expect.any(Number),
        requiredChecks: expect.any(Array),
        recommendedChecks: expect.any(Array),
        warnings: expect.any(Array),
        safeNextActions: expect.any(Array),
        nextActions: expect.any(Array),
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

  it('returns success with failing checks when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL

    const response = await GET(new Request('http://localhost/api/setup/status'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.requiredChecks).toEqual(expect.any(Array))
    expect(payload.data.recommendedChecks).toEqual(expect.any(Array))

    const databaseUrlCheck = payload.data.requiredChecks.find((check: { id: string }) => check.id === 'database-url')
    const databaseReachableCheck = payload.data.requiredChecks.find((check: { id: string }) => check.id === 'database-reachable')
    expect(databaseUrlCheck?.status).toBe('FAIL')
    expect(databaseReachableCheck?.status).toBe('WARN')
  })

  it('sanitizes database connectivity failures and still returns useful diagnostics', async () => {
    mocks.queryRaw.mockRejectedValueOnce(
      new Error('connect ECONNREFUSED postgresql://db_user:raw-password@localhost:5432/doopify')
    )

    const response = await GET(new Request('http://localhost/api/setup/status'))
    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)

    const databaseReachableCheck = payload.data.requiredChecks.find((check: { id: string }) => check.id === 'database-reachable')
    expect(databaseReachableCheck?.status).toBe('FAIL')
    expect(databaseReachableCheck?.fix).toContain('Verify database server accessibility and credentials')

    expect(serialized).toContain('db_user:***@')
    expect(serialized).not.toContain('raw-password')
  })
})
