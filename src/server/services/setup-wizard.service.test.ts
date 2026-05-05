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

  it('all steps need_setup when nothing is configured', () => {
    const report = buildSetupWizardSteps(allMissingFacts())

    expect(report.wizardComplete).toBe(false)
    expect(report.completedCount).toBe(0)

    const required = report.steps.filter((s) => s.isRequired)
    expect(required.every((s) => s.status === 'needs_setup')).toBe(true)

    const ownerStep = report.steps.find((s) => s.id === 'owner-account')
    expect(ownerStep?.status).toBe('needs_setup')
    expect(ownerStep?.ctaRoute).toBe('/create-owner')

    const pilotStep = report.steps.find((s) => s.id === 'pilot-readiness')
    expect(pilotStep?.status).toBe('needs_setup')
  })

  it('all steps ready when everything is configured', () => {
    const report = buildSetupWizardSteps(allReadyFacts())

    expect(report.wizardComplete).toBe(true)
    expect(report.completedCount).toBe(report.steps.length)

    report.steps.forEach((step) => {
      expect(step.status).toBe('ready')
    })

    const pilotStep = report.steps.find((s) => s.id === 'pilot-readiness')
    expect(pilotStep?.status).toBe('ready')
    expect(pilotStep?.reason).toContain('private beta')
  })

  it('Stripe DB credentials active — shows db-verified reason', () => {
    const facts = allReadyFacts()
    facts.stripeSource = 'db'
    facts.stripeVerified = true

    const report = buildSetupWizardSteps(facts)
    const stripe = report.steps.find((s) => s.id === 'stripe-connection')

    expect(stripe?.status).toBe('ready')
    expect(stripe?.reason).toContain('verified')
  })

  it('Stripe env fallback — keys present from env, no verification needed', () => {
    const facts = allReadyFacts()
    facts.stripeSource = 'env'
    facts.stripeVerified = false

    const report = buildSetupWizardSteps(facts)
    const stripe = report.steps.find((s) => s.id === 'stripe-connection')

    expect(stripe?.status).toBe('ready')
    expect(stripe?.reason).toContain('environment variables')
    expect(stripe?.ctaRoute).toBeUndefined()
  })

  it('Stripe DB credentials saved but not verified — needs_setup', () => {
    const facts = allReadyFacts()
    facts.stripeSource = 'db'
    facts.stripeVerified = false

    const report = buildSetupWizardSteps(facts)
    const stripe = report.steps.find((s) => s.id === 'stripe-connection')

    expect(stripe?.status).toBe('needs_setup')
    expect(stripe?.reason).toContain('verified')
    expect(stripe?.ctaRoute).toBe('/settings?section=payments')
  })

  it('no active shipping rates — shipping step needs_setup', () => {
    const facts = allReadyFacts()
    facts.shippingCanUseManualRates = false
    facts.shippingCanUseLiveRates = false

    const report = buildSetupWizardSteps(facts)
    const shipping = report.steps.find((s) => s.id === 'shipping')

    expect(shipping?.status).toBe('needs_setup')
    expect(shipping?.ctaRoute).toContain('shipping')
    expect(report.wizardComplete).toBe(false)
  })

  it('product missing price — product step needs_setup', () => {
    const facts = allReadyFacts()
    facts.activeProductsWithValidPrice = 0

    const report = buildSetupWizardSteps(facts)
    const product = report.steps.find((s) => s.id === 'product')

    expect(product?.status).toBe('needs_setup')
    expect(product?.reason).toContain('price')
    expect(product?.ctaRoute).toBe('/products')
  })

  it('product missing inventory — product step needs_setup', () => {
    const facts = allReadyFacts()
    facts.activeProductsWithInventory = 0

    const report = buildSetupWizardSteps(facts)
    const product = report.steps.find((s) => s.id === 'product')

    expect(product?.status).toBe('needs_setup')
    expect(product?.reason).toContain('inventory')
  })

  it('no active products at all — product step needs_setup with create CTA', () => {
    const facts = allReadyFacts()
    facts.activeProductCount = 0
    facts.activeProductsWithValidPrice = 0
    facts.activeProductsWithInventory = 0

    const report = buildSetupWizardSteps(facts)
    const product = report.steps.find((s) => s.id === 'product')

    expect(product?.status).toBe('needs_setup')
    expect(product?.reason).toContain('No active products')
    expect(product?.ctaRoute).toBe('/products')
  })

  it('email provider optional — does not block wizard completion', () => {
    const facts = allReadyFacts()
    facts.emailProviderSource = 'none'

    const report = buildSetupWizardSteps(facts)
    const email = report.steps.find((s) => s.id === 'email-provider')

    expect(email?.status).toBe('optional')
    expect(email?.isRequired).toBe(false)
    // wizard can still be complete without email
    expect(report.wizardComplete).toBe(true)
  })

  it('webhook secret missing — stripe-webhook step needs_setup', () => {
    const facts = allReadyFacts()
    facts.stripeHasWebhookSecret = false
    facts.stripeWebhookDeliveryReceived = false

    const report = buildSetupWizardSteps(facts)
    const webhook = report.steps.find((s) => s.id === 'stripe-webhook')

    expect(webhook?.status).toBe('needs_setup')
    expect(webhook?.reason).toContain('STRIPE_WEBHOOK_SECRET')
    expect(report.wizardComplete).toBe(false)
  })

  it('webhook secret set but no delivery received — partial, still needs_setup', () => {
    const facts = allReadyFacts()
    facts.stripeHasWebhookSecret = true
    facts.stripeWebhookDeliveryReceived = false

    const report = buildSetupWizardSteps(facts)
    const webhook = report.steps.find((s) => s.id === 'stripe-webhook')

    expect(webhook?.status).toBe('needs_setup')
    expect(webhook?.reason).toContain('no processed Stripe delivery')
  })

  it('no recent paid order — test-checkout step needs_setup', () => {
    const facts = allReadyFacts()
    facts.recentPaidOrderExists = false

    const report = buildSetupWizardSteps(facts)
    const checkout = report.steps.find((s) => s.id === 'test-checkout')

    expect(checkout?.status).toBe('needs_setup')
    expect(checkout?.reason).toContain('test checkout')
    expect(report.wizardComplete).toBe(false)
  })

  it('no secrets are exposed in any step', () => {
    const report = buildSetupWizardSteps(allReadyFacts())
    const allContent = JSON.stringify(report)

    expect(allContent).not.toMatch(/sk_test|sk_live|pk_test|pk_live/)
    expect(allContent).not.toMatch(/whsec_/)
    expect(allContent).not.toMatch(/re_[a-zA-Z0-9]/)
    expect(allContent).not.toMatch(/password|secret.*=/)
  })

  it('each step has a docs link', () => {
    const report = buildSetupWizardSteps(allMissingFacts())
    report.steps.forEach((step) => {
      expect(step.docsLink).toBeTruthy()
      expect(step.docsLink).toMatch(/^\/docs\//)
    })
  })

  it('pilot-readiness step reflects aggregate of required steps', () => {
    // Only shipping is failing
    const facts = allReadyFacts()
    facts.shippingCanUseManualRates = false
    facts.shippingCanUseLiveRates = false

    const report = buildSetupWizardSteps(facts)
    const pilot = report.steps.find((s) => s.id === 'pilot-readiness')

    expect(pilot?.status).toBe('needs_setup')
    expect(pilot?.reason).toContain('1 required step')
  })

  it('counts completedCount and requiredCount correctly', () => {
    const report = buildSetupWizardSteps(allReadyFacts())

    // 9 steps total, 7 required + 2 optional (email-provider, pilot-readiness)
    expect(report.requiredCount).toBe(7)
    expect(report.completedCount).toBe(9) // all ready
  })
})
