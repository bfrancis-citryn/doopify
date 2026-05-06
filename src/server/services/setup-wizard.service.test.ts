import { describe, expect, it } from 'vitest'

import {
  buildSetupWizardSteps,
  type SetupWizardFacts,
} from './setup-wizard.service'

function allMissingFacts(): SetupWizardFacts {
  return {
    ownerExists: false,
    storeNameConfigured: false,
    storeEmailConfigured: false,
    stripeSource: 'none',
    stripeVerified: false,
    stripeHasSecretKey: false,
    stripeHasPublishableKey: false,
    stripeHasWebhookSecret: false,
    stripeWebhookDeliveryReceived: false,
    shippingCanUseManualRates: false,
    shippingCanUseLiveRates: false,
    emailProviderSource: 'none',
    activeProductCount: 0,
    activeProductsWithValidPrice: 0,
    activeProductsWithInventory: 0,
    recentPaidOrderExists: false,
  }
}

function allReadyFacts(): SetupWizardFacts {
  return {
    ownerExists: true,
    storeNameConfigured: true,
    storeEmailConfigured: true,
    stripeSource: 'db',
    stripeVerified: true,
    stripeHasSecretKey: true,
    stripeHasPublishableKey: true,
    stripeHasWebhookSecret: true,
    stripeWebhookDeliveryReceived: true,
    shippingCanUseManualRates: true,
    shippingCanUseLiveRates: false,
    emailProviderSource: 'db',
    activeProductCount: 2,
    activeProductsWithValidPrice: 2,
    activeProductsWithInventory: 2,
    recentPaidOrderExists: true,
  }
}

describe('buildSetupWizardSteps', () => {
  it('returns 9 steps regardless of facts', () => {
    const report = buildSetupWizardSteps(allMissingFacts())
    expect(report.steps).toHaveLength(9)
    expect(report.steps.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('all required steps need setup when nothing is configured', () => {
    const report = buildSetupWizardSteps(allMissingFacts())

    expect(report.wizardComplete).toBe(false)
    expect(report.completedCount).toBe(0)

    const required = report.steps.filter((s) => s.isRequired)
    expect(required.every((s) => s.status === 'needs_setup')).toBe(true)

    const ownerStep = report.steps.find((s) => s.id === 'owner-account')
    expect(ownerStep?.status).toBe('needs_setup')
    expect(ownerStep?.ctaRoute).toBe('/create-owner')
  })

  it('all steps ready when everything is configured', () => {
    const report = buildSetupWizardSteps(allReadyFacts())

    expect(report.wizardComplete).toBe(true)
    expect(report.completedCount).toBe(report.steps.length)
    report.steps.forEach((step) => {
      expect(step.status).toBe('ready')
    })
  })

  it('marks Stripe as needs_setup when DB credentials are unverified', () => {
    const facts = allReadyFacts()
    facts.stripeVerified = false

    const report = buildSetupWizardSteps(facts)
    const stripe = report.steps.find((s) => s.id === 'stripe-connection')

    expect(stripe?.status).toBe('needs_setup')
    expect(stripe?.reason).toContain('have not been verified')
    expect(stripe?.ctaRoute).toBe('/settings?section=payments')
  })

  it('marks Stripe env fallback as needs_setup for private beta readiness', () => {
    const facts = allReadyFacts()
    facts.stripeSource = 'env'
    facts.stripeVerified = false

    const report = buildSetupWizardSteps(facts)
    const stripe = report.steps.find((s) => s.id === 'stripe-connection')

    expect(stripe?.status).toBe('needs_setup')
    expect(stripe?.reason).toContain('environment fallback')
    expect(stripe?.ctaRoute).toBe('/settings?section=payments')
  })

  it('keeps email optional when no provider is configured', () => {
    const facts = allReadyFacts()
    facts.emailProviderSource = 'none'

    const report = buildSetupWizardSteps(facts)
    const email = report.steps.find((s) => s.id === 'email-provider')

    expect(email?.status).toBe('optional')
    expect(email?.isRequired).toBe(false)
    expect(report.wizardComplete).toBe(true)
  })

  it('keeps email optional when env fallback is detected', () => {
    const facts = allReadyFacts()
    facts.emailProviderSource = 'env'

    const report = buildSetupWizardSteps(facts)
    const email = report.steps.find((s) => s.id === 'email-provider')

    expect(email?.status).toBe('optional')
    expect(email?.reason).toContain('environment fallback')
    expect(email?.ctaRoute).toBe('/settings?section=email')
  })

  it('marks webhook step as needs_setup when secret is missing', () => {
    const facts = allReadyFacts()
    facts.stripeHasWebhookSecret = false
    facts.stripeWebhookDeliveryReceived = false

    const report = buildSetupWizardSteps(facts)
    const webhook = report.steps.find((s) => s.id === 'stripe-webhook')

    expect(webhook?.status).toBe('needs_setup')
    expect(webhook?.reason).toContain('STRIPE_WEBHOOK_SECRET')
  })

  it('returns CTA routes for missing first-run required steps', () => {
    const report = buildSetupWizardSteps(allMissingFacts())
    const byId = new Map(report.steps.map((step) => [step.id, step]))

    expect(byId.get('store-profile')?.ctaRoute).toBe('/settings?section=general')
    expect(byId.get('stripe-connection')?.ctaRoute).toBe('/settings?section=payments')
    expect(byId.get('shipping')?.ctaRoute).toBe('/settings?section=shipping')
    expect(byId.get('product')?.ctaRoute).toBe('/products')
    expect(byId.get('test-checkout')?.status).toBe('needs_setup')
  })

  it('has docs links for all steps', () => {
    const report = buildSetupWizardSteps(allMissingFacts())
    report.steps.forEach((step) => {
      expect(step.docsLink).toMatch(/^\/docs\//)
    })
  })
})
