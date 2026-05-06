import { describe, expect, it } from 'vitest'

import {
  buildStripeWebhookEndpoint,
  evaluatePublicStoreUrl,
  resolveStripeWebhookEndpoint,
} from './public-store-url'

describe('public store URL helpers', () => {
  it('accepts a valid configured HTTPS URL', () => {
    const result = evaluatePublicStoreUrl({
      value: 'https://beta-store.vercel.app/',
      nodeEnv: 'production',
    })

    expect(result.ready).toBe(true)
    expect(result.valid).toBe(true)
    expect(result.normalizedBaseUrl).toBe('https://beta-store.vercel.app')
  })

  it('rejects known placeholder deployment URLs', () => {
    const result = evaluatePublicStoreUrl({
      value: 'https://your-doopify-beta-domain.vercel.app',
      nodeEnv: 'production',
    })

    expect(result.ready).toBe(false)
    expect(result.issue).toBe('placeholder')
  })

  it('rejects localhost URLs in production', () => {
    const result = evaluatePublicStoreUrl({
      value: 'http://localhost:3000',
      nodeEnv: 'production',
    })

    expect(result.ready).toBe(false)
    expect(result.issue).toBe('localhost_production')
  })

  it('builds Stripe webhook endpoint from base URL', () => {
    expect(buildStripeWebhookEndpoint('https://store.example.com/')).toBe(
      'https://store.example.com/api/webhooks/stripe'
    )
  })

  it('falls back to current origin for endpoint display while still requiring env readiness', () => {
    const result = resolveStripeWebhookEndpoint({
      nextPublicStoreUrl: 'https://your-doopify-beta-domain.vercel.app',
      currentOrigin: 'https://actual-store.vercel.app',
      nodeEnv: 'production',
    })

    expect(result.endpointUrl).toBe('https://actual-store.vercel.app/api/webhooks/stripe')
    expect(result.ready).toBe(false)
    expect(result.issue).toBe('placeholder')
  })
})
