type CredentialMetaEntry = {
  key: string
  present?: boolean
  maskedValue?: string | null
}

type StripeRuntimeProviderStatusSnapshot = {
  publishableKeyMasked?: string | null
  secretKeyMasked?: string | null
  webhookSecretMasked?: string | null
  mode?: string | null
}

type StripeRuntimeStatusSnapshot = {
  mode?: string | null
  publishableKeyMasked?: string | null
  secretKeyMasked?: string | null
  webhookSecretMasked?: string | null
  providerStatus?: StripeRuntimeProviderStatusSnapshot | null
}

export function buildMaskedCredentialMap(entries: CredentialMetaEntry[] | null | undefined) {
  const map: Record<string, string> = {}
  for (const entry of entries || []) {
    if (!entry?.key || !entry?.present || !entry.maskedValue) continue
    map[entry.key] = entry.maskedValue
  }
  return map
}

export function buildStripeMaskedCredentialMap(input: {
  credentialMeta?: CredentialMetaEntry[] | null
  runtimeStatus?: StripeRuntimeStatusSnapshot | null
  runtimeProviderStatus?: StripeRuntimeProviderStatusSnapshot | null
  runtimeMode?: string | null
}) {
  const map = buildMaskedCredentialMap(input.credentialMeta)
  const runtimeStatus = input.runtimeStatus || null
  const runtimeProviderStatus =
    input.runtimeProviderStatus || runtimeStatus?.providerStatus || runtimeStatus || {}

  if (!map.PUBLISHABLE_KEY && runtimeProviderStatus.publishableKeyMasked) {
    map.PUBLISHABLE_KEY = runtimeProviderStatus.publishableKeyMasked
  }

  if (!map.SECRET_KEY && runtimeProviderStatus.secretKeyMasked) {
    map.SECRET_KEY = runtimeProviderStatus.secretKeyMasked
  }

  if (!map.WEBHOOK_SECRET && runtimeProviderStatus.webhookSecretMasked) {
    map.WEBHOOK_SECRET = runtimeProviderStatus.webhookSecretMasked
  }

  const normalizedMode = String(
    map.MODE || runtimeProviderStatus.mode || runtimeStatus?.mode || input.runtimeMode || ''
  )
    .trim()
    .toLowerCase()
  if (normalizedMode === 'live' || normalizedMode === 'test') {
    map.MODE = normalizedMode
  }

  return map
}

export function resolveMaskedInputPlaceholder(input: {
  draftValue: string | null | undefined
  fallbackPlaceholder: string
  savedMaskedValue?: string | null
}) {
  const typedValue = String(input.draftValue || '').trim()
  if (typedValue) return input.fallbackPlaceholder

  const savedMaskedValue = String(input.savedMaskedValue || '').trim()
  if (savedMaskedValue) return savedMaskedValue

  return input.fallbackPlaceholder
}

type StripeDrawerForm = {
  publishableKey?: string | null
  secretKey?: string | null
  webhookSecret?: string | null
  mode?: string | null
}

export function resolveStripeConnectionState(input: {
  providerState?: string | null
  credentialMaskMap?: Record<string, string> | null
}) {
  const credentialMaskMap = input.credentialMaskMap || {}
  const hasSavedRequiredKeys = Boolean(credentialMaskMap.PUBLISHABLE_KEY && credentialMaskMap.SECRET_KEY)
  const normalizedProviderState = String(input.providerState || '')
    .trim()
    .toUpperCase()
  const fallbackState = hasSavedRequiredKeys ? 'CREDENTIALS_SAVED' : 'NOT_CONFIGURED'
  const rawState = normalizedProviderState || fallbackState

  if (hasSavedRequiredKeys && rawState === 'NOT_CONFIGURED') {
    return 'CREDENTIALS_SAVED'
  }

  return rawState
}

export function buildStripeCredentialSavePayload(input: StripeDrawerForm) {
  const publishableKey = String(input.publishableKey || '').trim()
  const secretKey = String(input.secretKey || '').trim()
  const webhookSecret = String(input.webhookSecret || '').trim()
  const normalizedMode = String(input.mode || '')
    .trim()
    .toLowerCase()

  return {
    publishableKey: publishableKey || undefined,
    secretKey: secretKey || undefined,
    webhookSecret: webhookSecret || undefined,
    mode: normalizedMode === 'live' ? 'live' : 'test',
  }
}
