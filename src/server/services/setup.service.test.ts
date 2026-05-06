import { describe, expect, it } from 'vitest'

import { buildSetupDoctorReport, deriveSafeNextActions, type SetupDoctorFacts } from './setup.service'

function baseFacts(): SetupDoctorFacts {
  return {
    nodeVersion: 'v22.12.0',
    nodeMajorVersion: 22,
    minimumNodeMajor: 20,
    npmAvailable: true,
    npmVersion: '10.9.0',
    dependenciesInstalled: true,
    missingDependencies: [],
    hasEnvFile: true,
    hasEnvLocalFile: true,
    databaseUrlPresent: true,
    databaseReachable: true,
    prismaClientGenerated: true,
    storeCount: 1,
    ownerCount: 1,
    storeConfigured: true,
    storeContactConfigured: true,
    jwtSecret: 'a-very-long-random-jwt-secret-value-1234567890',
    stripeSecretKeyPresent: true,
    stripePublishableKeyPresent: true,
    stripeWebhookSecretPresent: true,
    webhookRetrySecret: 'a-strong-retry-secret-1234567890',
    resendApiKeyPresent: true,
    resendWebhookSecretPresent: true,
    emailProviderWebhooksEnabled: true,
    nextPublicStoreUrl: 'https://shop.example.com',
    vercelEnvironmentDetected: true,
    vercelUrlPresent: true,
  }
}

describe('buildSetupDoctorReport', () => {
  it('returns ok when required checks pass (app profile)', () => {
    const report = buildSetupDoctorReport(baseFacts(), { profile: 'app' })

    expect(report.ok).toBe(true)
    expect(report.requiredFailCount).toBe(0)
    expect(report.failCount).toBe(0)
    expect(report.checks.some((check) => check.id === 'node-version')).toBe(false)
  })

  it('includes runtime checks in cli profile', () => {
    const report = buildSetupDoctorReport(baseFacts(), { profile: 'cli' })

    expect(report.checks.some((check) => check.id === 'node-version')).toBe(true)
    expect(report.checks.some((check) => check.id === 'npm-available')).toBe(true)
  })

  it('fails when required env values are missing', () => {
    const facts = baseFacts()
    facts.databaseUrlPresent = false
    facts.databaseReachable = false
    facts.jwtSecret = 'short'

    const report = buildSetupDoctorReport(facts, { profile: 'app' })

    expect(report.ok).toBe(false)
    expect(report.requiredFailCount).toBeGreaterThan(0)
    expect(report.checks.find((check) => check.id === 'database-url')?.status).toBe('FAIL')
    expect(report.checks.find((check) => check.id === 'jwt-secret')?.status).toBe('FAIL')
  })

  it('treats missing resend api key as preview mode warning', () => {
    const facts = baseFacts()
    facts.resendApiKeyPresent = false
    facts.emailProviderWebhooksEnabled = false
    facts.resendWebhookSecretPresent = false

    const report = buildSetupDoctorReport(facts, { profile: 'app' })

    expect(report.checks.find((check) => check.id === 'resend-api-or-preview')?.status).toBe('WARN')
    expect(report.checks.find((check) => check.id === 'resend-webhook-secret-enabled')?.status).toBe('WARN')
  })

  it('does not claim Stripe API verification from env-only checks', () => {
    const report = buildSetupDoctorReport(baseFacts(), { profile: 'app' })
    const stripeCheck = report.checks.find((check) => check.id === 'stripe-keys')

    expect(stripeCheck?.status).toBe('PASS')
    expect(stripeCheck?.summary).toContain('Provider API verification has not been run from this screen')
  })

  it('explains resend webhook verification when api key exists but webhook secret is missing', () => {
    const facts = baseFacts()
    facts.resendApiKeyPresent = true
    facts.resendWebhookSecretPresent = false
    facts.emailProviderWebhooksEnabled = true

    const report = buildSetupDoctorReport(facts, { profile: 'app' })
    const resendWebhookCheck = report.checks.find((check) => check.id === 'resend-webhook-secret-enabled')

    expect(resendWebhookCheck?.status).toBe('FAIL')
    expect(resendWebhookCheck?.summary).toContain(
      'Live email sending may work, but bounce/complaint webhook verification is not configured.'
    )
  })

  it('derives safe next actions from failing/warn checks', () => {
    const facts = baseFacts()
    facts.jwtSecret = 'short'
    facts.nextPublicStoreUrl = undefined

    const report = buildSetupDoctorReport(facts, { profile: 'app' })
    const actions = deriveSafeNextActions(report.checks)

    expect(actions.length).toBeGreaterThan(0)
    expect(actions.some((action) => action.includes('JWT_SECRET'))).toBe(true)
  })

  it('fails public URL check when NEXT_PUBLIC_STORE_URL uses placeholder domain', () => {
    const facts = baseFacts()
    facts.nextPublicStoreUrl = 'https://your-doopify-beta-domain.vercel.app'

    const report = buildSetupDoctorReport(facts, { profile: 'app' })
    const urlCheck = report.checks.find((check) => check.id === 'next-public-store-url')

    expect(urlCheck?.status).toBe('FAIL')
    expect(urlCheck?.summary).toContain('placeholder domain')
  })
})
