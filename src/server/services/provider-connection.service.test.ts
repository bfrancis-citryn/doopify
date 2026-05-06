import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  env: {
    DATABASE_URL: 'postgresql://localhost/test',
    JWT_SECRET: 'test_jwt_secret_for_tests_only_123456',
    NODE_ENV: 'test',
    STRIPE_SECRET_KEY: undefined as string | undefined,
    STRIPE_WEBHOOK_SECRET: undefined as string | undefined,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined as string | undefined,
    RESEND_API_KEY: 're_env_key',
    RESEND_WEBHOOK_SECRET: undefined,
    SMTP_HOST: undefined,
    SMTP_PORT: undefined,
    SMTP_SECURE: undefined,
    SMTP_USERNAME: undefined,
    SMTP_PASSWORD: undefined,
    SMTP_FROM_EMAIL: undefined,
    SHIPPO_API_KEY: undefined,
    EASYPOST_API_KEY: undefined,
    EASYPOST_WEBHOOK_SECRET: undefined,
    SHIPPO_WEBHOOK_SECRET: undefined,
    NEXT_PUBLIC_STORE_URL: undefined,
    WEBHOOK_RETRY_SECRET: undefined,
    JOB_RUNNER_SECRET: undefined,
    ABANDONED_CHECKOUT_SECRET: undefined,
  },
  prisma: {
    integration: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    integrationSecret: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  encrypt: vi.fn((value: string) => `enc:${value}`),
  decrypt: vi.fn((value: string) => value.replace(/^enc:/, '')),
  connectShippingProvider: vi.fn(),
  disconnectShippingProvider: vi.fn(),
  getShippingProviderConnectionStatus: vi.fn(),
  testShippingProviderConnection: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ env: mocks.env }))
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/server/utils/crypto', () => ({
  encrypt: mocks.encrypt,
  decrypt: mocks.decrypt,
}))
vi.mock('@/server/shipping/shipping-provider.service', () => ({
  connectShippingProvider: mocks.connectShippingProvider,
  disconnectShippingProvider: mocks.disconnectShippingProvider,
  getShippingProviderConnectionStatus: mocks.getShippingProviderConnectionStatus,
  testShippingProviderConnection: mocks.testShippingProviderConnection,
}))

import {
  getRuntimeProviderConnection,
  saveProviderCredentials,
} from './provider-connection.service'

describe('provider connection service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.$transaction.mockImplementation(async (callback: any) => callback(mocks.prisma))
    mocks.prisma.integration.updateMany.mockResolvedValue({ count: 0 })
    mocks.prisma.integrationSecret.deleteMany.mockResolvedValue({ count: 0 })
    mocks.env.RESEND_API_KEY = 're_env_key'
    mocks.env.RESEND_WEBHOOK_SECRET = undefined
    mocks.env.STRIPE_SECRET_KEY = undefined
    mocks.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = undefined
    mocks.env.STRIPE_WEBHOOK_SECRET = undefined
  })

  it('prefers verified db credentials over env fallback', async () => {
    mocks.prisma.integration.findFirst.mockResolvedValue({
      id: 'int_resend_1',
      type: 'EMAIL_RESEND',
      status: 'ACTIVE',
      updatedAt: new Date('2026-04-30T01:00:00.000Z'),
      secrets: [
        { id: 'sec_1', key: 'API_KEY', value: 'enc:re_db_key' },
        { id: 'sec_2', key: 'META_LAST_VERIFIED_AT', value: 'enc:2026-04-30T01:05:00.000Z' },
      ],
    })

    const runtime = await getRuntimeProviderConnection('RESEND')

    expect(runtime).toMatchObject({
      source: 'db',
      verified: true,
      credentials: {
        API_KEY: 're_db_key',
      },
    })
  })

  it('falls back to env credentials when db connection is missing', async () => {
    mocks.prisma.integration.findFirst.mockResolvedValue(null)

    const runtime = await getRuntimeProviderConnection('RESEND')

    expect(runtime).toMatchObject({
      source: 'env',
      verified: false,
      credentials: {
        API_KEY: 're_env_key',
      },
    })
  })

  it('treats placeholder Resend env credentials as missing', async () => {
    mocks.env.RESEND_API_KEY = 're_replace_me'
    mocks.prisma.integration.findFirst.mockResolvedValue(null)

    const runtime = await getRuntimeProviderConnection('RESEND')

    expect(runtime).toMatchObject({
      source: 'none',
      verified: false,
      credentials: null,
    })
  })

  it('stores provider credentials through encrypted integration secret writes', async () => {
    const integrationRecord = {
      id: 'int_resend_2',
      type: 'EMAIL_RESEND',
      status: 'ACTIVE',
      updatedAt: new Date('2026-04-30T02:00:00.000Z'),
      secrets: [{ id: 'sec_saved', key: 'API_KEY', value: 'enc:re_saved_key' }],
    }

    mocks.prisma.integration.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue(integrationRecord)

    mocks.prisma.integration.create.mockResolvedValue({ id: 'int_resend_2' })

    const status = await saveProviderCredentials('RESEND', { apiKey: 're_saved_key' })

    expect(mocks.encrypt).toHaveBeenCalledWith('re_saved_key')
    expect(mocks.prisma.integrationSecret.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'API_KEY',
          value: 'enc:re_saved_key',
        }),
        update: expect.objectContaining({
          value: 'enc:re_saved_key',
        }),
      })
    )
    expect(status.state).toBe('CREDENTIALS_SAVED')
  })

  it('prefers verified Stripe DB credentials over env fallback', async () => {
    mocks.env.STRIPE_SECRET_KEY = 'sk_test_env_runtime'
    mocks.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_env_runtime'
    mocks.env.STRIPE_WEBHOOK_SECRET = 'whsec_env_runtime'
    mocks.prisma.integration.findFirst.mockResolvedValue({
      id: 'int_stripe_1',
      type: 'PAYMENT_STRIPE',
      status: 'ACTIVE',
      updatedAt: new Date('2026-04-30T03:00:00.000Z'),
      secrets: [
        { id: 'sec_1', key: 'SECRET_KEY', value: 'enc:sk_live_db_runtime' },
        { id: 'sec_2', key: 'PUBLISHABLE_KEY', value: 'enc:pk_live_db_runtime' },
        { id: 'sec_3', key: 'MODE', value: 'enc:live' },
        { id: 'sec_4', key: 'WEBHOOK_SECRET', value: 'enc:whsec_live_db_runtime' },
        { id: 'sec_5', key: 'META_LAST_VERIFIED_AT', value: 'enc:2026-04-30T03:05:00.000Z' },
      ],
    })

    const runtime = await getRuntimeProviderConnection('STRIPE')

    expect(runtime).toMatchObject({
      source: 'db',
      verified: true,
      credentials: {
        SECRET_KEY: 'sk_live_db_runtime',
        PUBLISHABLE_KEY: 'pk_live_db_runtime',
        MODE: 'live',
        WEBHOOK_SECRET: 'whsec_live_db_runtime',
      },
    })
  })

  it('ignores unverified Stripe DB credentials and falls back to env', async () => {
    mocks.env.STRIPE_SECRET_KEY = 'sk_test_env_runtime'
    mocks.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_env_runtime'
    mocks.env.STRIPE_WEBHOOK_SECRET = 'whsec_env_runtime'
    mocks.prisma.integration.findFirst.mockResolvedValue({
      id: 'int_stripe_2',
      type: 'PAYMENT_STRIPE',
      status: 'ACTIVE',
      updatedAt: new Date('2026-04-30T03:10:00.000Z'),
      secrets: [
        { id: 'sec_1', key: 'SECRET_KEY', value: 'enc:sk_live_db_unverified' },
        { id: 'sec_2', key: 'PUBLISHABLE_KEY', value: 'enc:pk_live_db_unverified' },
        { id: 'sec_3', key: 'MODE', value: 'enc:live' },
      ],
    })

    const runtime = await getRuntimeProviderConnection('STRIPE')

    expect(runtime).toMatchObject({
      source: 'env',
      verified: false,
      credentials: {
        SECRET_KEY: 'sk_test_env_runtime',
        PUBLISHABLE_KEY: 'pk_test_env_runtime',
        WEBHOOK_SECRET: 'whsec_env_runtime',
        MODE: 'test',
      },
    })
  })

  it('treats placeholder Stripe env credentials as missing', async () => {
    mocks.env.STRIPE_SECRET_KEY = 'sk_test_replace_me'
    mocks.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_replace_me'
    mocks.env.STRIPE_WEBHOOK_SECRET = 'whsec_replace_me'
    mocks.prisma.integration.findFirst.mockResolvedValue(null)

    const runtime = await getRuntimeProviderConnection('STRIPE')

    expect(runtime).toMatchObject({
      source: 'none',
      verified: false,
      credentials: null,
    })
  })

  it('encrypts Stripe SECRET_KEY and WEBHOOK_SECRET when saving credentials', async () => {
    const integrationRecord = {
      id: 'int_stripe_save',
      type: 'PAYMENT_STRIPE',
      status: 'ACTIVE',
      updatedAt: new Date('2026-04-30T04:00:00.000Z'),
      secrets: [
        { id: 'sec_1', key: 'SECRET_KEY', value: 'enc:sk_live_new_secret' },
        { id: 'sec_2', key: 'PUBLISHABLE_KEY', value: 'enc:pk_live_new_key' },
        { id: 'sec_3', key: 'MODE', value: 'enc:live' },
        { id: 'sec_4', key: 'WEBHOOK_SECRET', value: 'enc:whsec_live_new_secret' },
      ],
    }

    mocks.prisma.integration.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue(integrationRecord)

    mocks.prisma.integration.create.mockResolvedValue({ id: 'int_stripe_save' })

    const status = await saveProviderCredentials('STRIPE', {
      publishableKey: 'pk_live_new_key',
      secretKey: 'sk_live_new_secret',
      webhookSecret: 'whsec_live_new_secret',
      mode: 'live',
    })

    expect(mocks.encrypt).toHaveBeenCalledWith('sk_live_new_secret')
    expect(mocks.encrypt).toHaveBeenCalledWith('whsec_live_new_secret')
    expect(mocks.encrypt).toHaveBeenCalledWith('pk_live_new_key')

    const allUpsertArgs = mocks.prisma.integrationSecret.upsert.mock.calls as Array<[{ create: { key: string; value: string }; update: { value: string } }]>
    const secretKeyUpsert = allUpsertArgs.find((args) => args[0].create.key === 'SECRET_KEY')
    expect(secretKeyUpsert).toBeDefined()
    expect(secretKeyUpsert![0].create.value).toBe('enc:sk_live_new_secret')
    expect(secretKeyUpsert![0].update.value).toBe('enc:sk_live_new_secret')

    const webhookUpsert = allUpsertArgs.find((args) => args[0].create.key === 'WEBHOOK_SECRET')
    expect(webhookUpsert).toBeDefined()
    expect(webhookUpsert![0].create.value).toBe('enc:whsec_live_new_secret')

    expect(status.state).toBe('CREDENTIALS_SAVED')
  })
})

