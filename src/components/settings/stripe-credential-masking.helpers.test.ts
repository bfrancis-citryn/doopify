import { describe, expect, it } from 'vitest'

import {
  buildMaskedCredentialMap,
  buildStripeMaskedCredentialMap,
  resolveMaskedInputPlaceholder,
} from './stripe-credential-masking.helpers'

describe('stripe credential masking helpers', () => {
  it('keeps only present masked entries and ignores missing values', () => {
    const map = buildMaskedCredentialMap([
      { key: 'PUBLISHABLE_KEY', present: true, maskedValue: 'pk_test_******1234' },
      { key: 'SECRET_KEY', present: false, maskedValue: 'sk_test_******5678' },
      { key: 'WEBHOOK_SECRET', present: true, maskedValue: null },
    ])

    expect(map).toEqual({
      PUBLISHABLE_KEY: 'pk_test_******1234',
    })
  })

  it('shows saved masked placeholders when fields are intentionally cleared after save', () => {
    const placeholder = resolveMaskedInputPlaceholder({
      draftValue: '',
      fallbackPlaceholder: 'sk_test_...',
      savedMaskedValue: 'sk_test_******1234',
    })

    expect(placeholder).toBe('sk_test_******1234')
  })

  it('uses the generic placeholder while typing a new replacement secret', () => {
    const placeholder = resolveMaskedInputPlaceholder({
      draftValue: 'sk_test_new_value',
      fallbackPlaceholder: 'sk_test_...',
      savedMaskedValue: 'sk_test_******1234',
    })

    expect(placeholder).toBe('sk_test_...')
  })

  it('never surfaces raw secret values through placeholder mapping', () => {
    const rawSecret = 'sk_test_raw_secret_never_show_this'
    const map = buildMaskedCredentialMap([
      {
        key: 'SECRET_KEY',
        present: true,
        maskedValue: 'sk_test_******1234',
        // @ts-expect-error raw values are ignored by the helper contract
        rawValue: rawSecret,
      },
    ])

    expect(map.SECRET_KEY).toBe('sk_test_******1234')
    expect(JSON.stringify(map)).not.toContain(rawSecret)
  })

  it('hydrates masked Stripe values from runtime snapshot when provider credential meta is temporarily empty', () => {
    const map = buildStripeMaskedCredentialMap({
      credentialMeta: [],
      runtimeProviderStatus: {
        publishableKeyMasked: 'pk_test_******1234',
        secretKeyMasked: 'sk_test_******5678',
        webhookSecretMasked: 'whsec_******9012',
        mode: 'test',
      },
    })

    expect(map).toEqual({
      PUBLISHABLE_KEY: 'pk_test_******1234',
      SECRET_KEY: 'sk_test_******5678',
      WEBHOOK_SECRET: 'whsec_******9012',
      MODE: 'test',
    })
  })

  it('retains saved masked values across close and reopen flows', () => {
    const firstOpenMap = buildStripeMaskedCredentialMap({
      credentialMeta: [
        { key: 'PUBLISHABLE_KEY', present: true, maskedValue: 'pk_test_******1234' },
        { key: 'SECRET_KEY', present: true, maskedValue: 'sk_test_******5678' },
        { key: 'MODE', present: true, maskedValue: 'test' },
      ],
      runtimeProviderStatus: null,
    })

    const reopenMap = buildStripeMaskedCredentialMap({
      credentialMeta: [],
      runtimeProviderStatus: {
        publishableKeyMasked: 'pk_test_******1234',
        secretKeyMasked: 'sk_test_******5678',
        mode: 'test',
      },
    })

    expect(reopenMap.PUBLISHABLE_KEY).toBe(firstOpenMap.PUBLISHABLE_KEY)
    expect(reopenMap.SECRET_KEY).toBe(firstOpenMap.SECRET_KEY)
    expect(reopenMap.MODE).toBe('test')
  })
})
