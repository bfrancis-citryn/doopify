import { beforeEach, describe, expect, it, vi } from 'vitest'

const envState = vi.hoisted(() => ({
  STRIPE_SECRET_KEY: 'sk_test_env_key',
}))

const stripeCtorSpy = vi.hoisted(() => vi.fn())

vi.mock('@/lib/env', () => ({
  env: envState,
}))

vi.mock('stripe', () => ({
  default: class StripeMock {
    constructor(secretKey: string) {
      stripeCtorSpy(secretKey)
    }
  },
}))

import { getStripeSdkClient } from './stripe-client'

describe('getStripeSdkClient', () => {
  beforeEach(() => {
    stripeCtorSpy.mockReset()
    envState.STRIPE_SECRET_KEY = 'sk_test_env_key'
  })

  it('uses override secret key when provided', () => {
    getStripeSdkClient('  sk_test_override_key  ')

    expect(stripeCtorSpy).toHaveBeenCalledWith('sk_test_override_key')
  })

  it('falls back to env STRIPE_SECRET_KEY when override is missing', () => {
    getStripeSdkClient()

    expect(stripeCtorSpy).toHaveBeenCalledWith('sk_test_env_key')
  })

  it('throws when no override and no env key are available', () => {
    envState.STRIPE_SECRET_KEY = undefined as unknown as string

    expect(() => getStripeSdkClient()).toThrow('STRIPE_SECRET_KEY is not configured')
  })
})
