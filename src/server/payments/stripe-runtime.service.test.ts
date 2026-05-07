import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  env: {
    DATABASE_URL: 'postgresql://localhost/test',
    JWT_SECRET: 'test_jwt_secret_for_tests_only_123456',
    NODE_ENV: 'test',
    STRIPE_SECRET_KEY: 'sk_test_env_runtime' as string | undefined,
    STRIPE_WEBHOOK_SECRET: 'whsec_env_runtime' as string | undefined,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_env_runtime' as string | undefined,
    RESEND_API_KEY: undefined,
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
  getRuntimeProviderConnection: vi.fn(),
  getStripeProviderStatusSnapshot: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ env: mocks.env }))
vi.mock('@/server/services/provider-connection.service', () => ({
  getRuntimeProviderConnection: mocks.getRuntimeProviderConnection,
  getStripeProviderStatusSnapshot: mocks.getStripeProviderStatusSnapshot,
}))

import {
  getStripeRuntimeConnection,
  getStripeWebhookSecretSelection,
} from './stripe-runtime.service'

describe('stripe runtime service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.env.STRIPE_WEBHOOK_SECRET = 'whsec_env_runtime'
  })

  it('prefers verified DB credentials over env fallback credentials', async () => {
    mocks.getRuntimeProviderConnection.mockResolvedValue({
      source: 'db',
      provider: 'STRIPE',
      verified: true,
      credentials: {
        SECRET_KEY: 'sk_live_db_runtime',
        PUBLISHABLE_KEY: 'pk_live_db_runtime',
        WEBHOOK_SECRET: 'whsec_live_db_runtime',
        MODE: 'live',
      },
    })
    mocks.getStripeProviderStatusSnapshot.mockResolvedValue({
      accountId: 'acct_live_123',
      chargesEnabled: true,
      payoutsEnabled: true,
    })

    const runtime = await getStripeRuntimeConnection()

    expect(runtime).toEqual({
      source: 'db',
      verified: true,
      mode: 'live',
      publishableKey: 'pk_live_db_runtime',
      secretKey: 'sk_live_db_runtime',
      webhookSecret: 'whsec_live_db_runtime',
      accountId: 'acct_live_123',
      chargesEnabled: true,
      payoutsEnabled: true,
    })
  })

  it('uses env fallback when DB Stripe connection is not verified', async () => {
    mocks.getRuntimeProviderConnection.mockResolvedValue({
      source: 'env',
      provider: 'STRIPE',
      verified: false,
      credentials: {
        SECRET_KEY: 'sk_test_env_runtime',
        PUBLISHABLE_KEY: 'pk_test_env_runtime',
        WEBHOOK_SECRET: 'whsec_env_runtime',
        MODE: 'test',
      },
    })

    const runtime = await getStripeRuntimeConnection()

    expect(runtime).toMatchObject({
      source: 'env',
      verified: false,
      mode: 'test',
      publishableKey: 'pk_test_env_runtime',
      secretKey: 'sk_test_env_runtime',
      webhookSecret: 'whsec_env_runtime',
    })
    expect(mocks.getStripeProviderStatusSnapshot).not.toHaveBeenCalled()
  })

  it('returns source none when no DB or env Stripe connection exists', async () => {
    mocks.getRuntimeProviderConnection.mockResolvedValue({
      source: 'none',
      provider: 'STRIPE',
      verified: false,
      credentials: null,
    })

    const runtime = await getStripeRuntimeConnection()

    expect(runtime).toEqual({
      source: 'none',
      verified: false,
      mode: null,
      publishableKey: null,
      secretKey: null,
      webhookSecret: null,
      accountId: null,
      chargesEnabled: null,
      payoutsEnabled: null,
    })
  })

  it('prefers verified DB webhook secret for webhook verification', async () => {
    mocks.getRuntimeProviderConnection.mockResolvedValue({
      source: 'db',
      provider: 'STRIPE',
      verified: true,
      credentials: {
        SECRET_KEY: 'sk_live_db_runtime',
        PUBLISHABLE_KEY: 'pk_live_db_runtime',
        WEBHOOK_SECRET: 'whsec_live_db_runtime',
        MODE: 'live',
      },
    })
    mocks.getStripeProviderStatusSnapshot.mockResolvedValue({
      accountId: null,
      chargesEnabled: null,
      payoutsEnabled: null,
    })

    const selection = await getStripeWebhookSecretSelection()

    expect(selection).toEqual({
      source: 'db',
      webhookSecret: 'whsec_live_db_runtime',
    })
  })

  it('falls back to env webhook secret when DB webhook secret is unavailable', async () => {
    mocks.getRuntimeProviderConnection.mockResolvedValue({
      source: 'db',
      provider: 'STRIPE',
      verified: true,
      credentials: {
        SECRET_KEY: 'sk_live_db_runtime',
        PUBLISHABLE_KEY: 'pk_live_db_runtime',
        MODE: 'live',
      },
    })
    mocks.getStripeProviderStatusSnapshot.mockResolvedValue({
      accountId: null,
      chargesEnabled: null,
      payoutsEnabled: null,
    })

    const selection = await getStripeWebhookSecretSelection()

    expect(selection).toEqual({
      source: 'env',
      webhookSecret: 'whsec_env_runtime',
    })
  })

  it('returns none when webhook secret is unavailable in DB and env', async () => {
    mocks.env.STRIPE_WEBHOOK_SECRET = undefined
    mocks.getRuntimeProviderConnection.mockResolvedValue({
      source: 'none',
      provider: 'STRIPE',
      verified: false,
      credentials: null,
    })

    const selection = await getStripeWebhookSecretSelection()

    expect(selection).toEqual({
      source: 'none',
      webhookSecret: null,
    })
  })

  it('returns none when env webhook secret is placeholder', async () => {
    mocks.env.STRIPE_WEBHOOK_SECRET = 'whsec_replace_me'
    mocks.getRuntimeProviderConnection.mockResolvedValue({
      source: 'none',
      provider: 'STRIPE',
      verified: false,
      credentials: null,
    })

    const selection = await getStripeWebhookSecretSelection()

    expect(selection).toEqual({
      source: 'none',
      webhookSecret: null,
    })
  })
})
