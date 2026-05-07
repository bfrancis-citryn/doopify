import { describe, expect, it } from 'vitest'

import { getShippingHeaderSaveButtonState } from './shipping-save-button.helpers'

describe('shipping header save button helper', () => {
  it('enables Save changes when shipping mode is dirty and a save action exists', () => {
    const state = getShippingHeaderSaveButtonState({
      loading: false,
      hasError: false,
      shippingConfigLoading: false,
      hasSaveAction: true,
      shippingModeSavedState: 'dirty',
      shippingModeDirty: true,
    })

    expect(state.disabled).toBe(false)
    expect(state.label).toBe('Save changes')
  })

  it('shows Saving... and disables the button while save is in flight', () => {
    const state = getShippingHeaderSaveButtonState({
      hasSaveAction: true,
      shippingModeSavedState: 'saving',
      shippingModeDirty: true,
    })

    expect(state.disabled).toBe(true)
    expect(state.label).toBe('Saving...')
  })

  it('keeps Save changes label after a failed save so retry stays clear', () => {
    const state = getShippingHeaderSaveButtonState({
      hasSaveAction: true,
      shippingModeSavedState: 'error',
      shippingModeDirty: true,
    })

    expect(state.disabled).toBe(false)
    expect(state.label).toBe('Save changes')
  })
})
