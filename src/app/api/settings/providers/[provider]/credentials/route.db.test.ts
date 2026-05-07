import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { prisma } from '@/lib/prisma'
import { decrypt } from '@/server/utils/crypto'

vi.mock('@/server/auth/require-auth', () => ({
  requireOwner: vi.fn().mockResolvedValue({
    ok: true,
    user: { id: 'owner-integration', email: 'owner@example.com', firstName: null, lastName: null, role: 'OWNER' },
  }),
}))

vi.mock('@/server/services/audit-log.service', () => ({
  auditActorFromUser: vi.fn().mockReturnValue({
    actorType: 'STAFF',
    actorId: 'owner-integration',
    actorEmail: 'owner@example.com',
    actorRole: 'OWNER',
  }),
  recordAuditLogBestEffort: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'

const runIntegration =
  process.env.DATABASE_URL_TEST && process.env.DATABASE_URL === process.env.DATABASE_URL_TEST
    ? describe
    : describe.skip

async function cleanStripeIntegrations() {
  const rows = await prisma.integration.findMany({
    where: { type: 'PAYMENT_STRIPE' },
    select: { id: true },
  })
  if (!rows.length) return
  const ids = rows.map((row) => row.id)
  await prisma.integrationSecret.deleteMany({ where: { integrationId: { in: ids } } })
  await prisma.integration.updateMany({
    where: { id: { in: ids } },
    data: { status: 'INACTIVE' },
  })
}

runIntegration('settings providers Stripe credentials route integration', () => {
  beforeEach(async () => {
    await cleanStripeIntegrations()
  }, 60_000)

  afterAll(async () => {
    await cleanStripeIntegrations()
    await prisma.$disconnect()
  }, 60_000)

  it('saves Stripe settings through route and persists masked-status-backed DB secrets', async () => {
    const response = await POST(
      new Request('http://localhost/api/settings/providers/stripe/credentials', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          publishableKey: 'pk_test_route_saved_1234',
          secretKey: 'sk_test_route_saved_5678',
          webhookSecret: 'whsec_route_saved_9012',
          mode: 'test',
        }),
      }),
      { params: Promise.resolve({ provider: 'stripe' }) }
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload?.success).toBe(true)
    expect(payload?.data?.status?.source).toBe('db')
    expect(payload?.data?.status?.state).toMatch(/CREDENTIALS_SAVED|VERIFIED|ERROR/)
    expect(JSON.stringify(payload)).not.toContain('sk_test_route_saved_5678')
    expect(JSON.stringify(payload)).not.toContain('whsec_route_saved_9012')

    const rows = await prisma.integration.findMany({
      where: { type: 'PAYMENT_STRIPE' },
      include: { secrets: true },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

    expect(rows.length).toBeGreaterThan(0)
    const activeRows = rows.filter((row) => row.status === 'ACTIVE')
    expect(activeRows.length).toBeGreaterThan(0)

    const latestActive = activeRows[0]
    const secretByKey = new Map(latestActive.secrets.map((secret) => [secret.key, secret.value]))
    expect(secretByKey.has('PUBLISHABLE_KEY')).toBe(true)
    expect(secretByKey.has('SECRET_KEY')).toBe(true)
    expect(secretByKey.has('MODE')).toBe(true)
    expect(secretByKey.has('WEBHOOK_SECRET')).toBe(true)

    expect(decrypt(secretByKey.get('PUBLISHABLE_KEY')!)).toBe('pk_test_route_saved_1234')
    expect(decrypt(secretByKey.get('SECRET_KEY')!)).toBe('sk_test_route_saved_5678')
    expect(decrypt(secretByKey.get('MODE')!)).toBe('test')
    expect(decrypt(secretByKey.get('WEBHOOK_SECRET')!)).toBe('whsec_route_saved_9012')
  })
})
