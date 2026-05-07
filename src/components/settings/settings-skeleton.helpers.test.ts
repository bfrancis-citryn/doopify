import { describe, expect, it } from 'vitest'

import { isSettingsTabLoadingState } from './settings-skeleton.helpers'

describe('settings skeleton loading state', () => {
  it('shows skeleton for initial general loading', () => {
    expect(
      isSettingsTabLoadingState({
        activeSection: 'general',
        loading: true,
      })
    ).toBe(true)
  })

  it('shows skeleton for payments while provider or activity data is loading', () => {
    expect(
      isSettingsTabLoadingState({
        activeSection: 'payments',
        providerStatusLoading: true,
        providerStatusLoaded: false,
      })
    ).toBe(true)
  })

  it('shows skeleton for taxes while shipping config data is loading', () => {
    expect(
      isSettingsTabLoadingState({
        activeSection: 'taxes',
        shippingConfigLoading: true,
        shippingConfigLoaded: false,
      })
    ).toBe(true)
  })

  it('shows skeleton for email while provider or activity data is loading', () => {
    expect(
      isSettingsTabLoadingState({
        activeSection: 'email',
        emailActivityLoading: true,
        emailActivityLoaded: false,
      })
    ).toBe(true)
  })

  it('shows skeleton for brand kit while brand data is loading', () => {
    expect(
      isSettingsTabLoadingState({
        activeSection: 'brand-kit',
        brandKitLoading: true,
        brandKitLoaded: false,
      })
    ).toBe(true)
  })

  it('shows skeleton for account until session user resolves', () => {
    expect(
      isSettingsTabLoadingState({
        activeSection: 'account',
        sessionUser: null,
      })
    ).toBe(true)
  })

  it('shows skeleton for setup while checklist services are loading', () => {
    expect(
      isSettingsTabLoadingState({
        activeSection: 'setup',
        setupLoading: true,
        setupLoaded: false,
      })
    ).toBe(true)
  })

  it('does not show skeleton once tab data is loaded', () => {
    expect(
      isSettingsTabLoadingState({
        activeSection: 'payments',
        providerStatusLoading: false,
        providerStatusLoaded: true,
        paymentActivityLoading: false,
        paymentActivityLoaded: true,
      })
    ).toBe(false)
  })

  it('does not show skeleton when a hard error is present', () => {
    expect(
      isSettingsTabLoadingState({
        activeSection: 'general',
        loading: true,
        hasError: true,
      })
    ).toBe(false)
  })
})
