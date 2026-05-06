import { describe, expect, it } from 'vitest'

import { buildDashboardFirstRunGuide } from './dashboard-first-run-guide.helpers'

describe('buildDashboardFirstRunGuide', () => {
  it('returns null when wizard is complete', () => {
    const guide = buildDashboardFirstRunGuide({
      wizardComplete: true,
      steps: [],
    })

    expect(guide).toBeNull()
  })

  it('returns required and optional checklist steps when setup is incomplete', () => {
    const guide = buildDashboardFirstRunGuide({
      wizardComplete: false,
      steps: [
        { id: 'store-profile', status: 'needs_setup', ctaRoute: '/settings?section=general' },
        { id: 'stripe-connection', status: 'needs_setup', ctaRoute: '/settings?section=payments' },
        { id: 'shipping', status: 'needs_setup', ctaRoute: '/settings?section=shipping' },
        { id: 'product', status: 'needs_setup', ctaRoute: '/products' },
        { id: 'test-checkout', status: 'needs_setup' },
        { id: 'email-provider', status: 'optional', ctaRoute: '/settings?section=email' },
      ],
    })

    expect(guide).not.toBeNull()
    expect(guide?.requiredSteps.map((step) => step.title)).toEqual([
      'Store profile',
      'Stripe',
      'Shipping',
      'Product',
      'Test checkout',
    ])
    expect(guide?.optionalSteps.map((step) => step.title)).toEqual([
      'Email',
      'Team',
      'MFA',
    ])
    expect(guide?.requiredSteps[0].route).toBe('/settings?section=general')
    expect(guide?.requiredSteps[1].route).toBe('/settings?section=payments')
    expect(guide?.requiredSteps[2].route).toBe('/settings?section=shipping')
    expect(guide?.requiredSteps[3].route).toBe('/products')
    expect(guide?.requiredSteps[4].route).toBe('/shop')
    expect(guide?.requiredSteps.every((step) => step.statusLabel === 'Needs setup')).toBe(true)
  })
})
