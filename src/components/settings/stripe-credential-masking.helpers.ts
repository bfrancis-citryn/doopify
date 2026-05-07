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
  runtimeProviderStatus?: StripeRuntimeProviderStatusSnapshot | null
  runtimeMode?: string | null
}) {
  const map = buildMaskedCredentialMap(input.credentialMeta)
  const runtimeProviderStatus = input.runtimeProviderStatus || {}

  if (!map.PUBLISHABLE_KEY && runtimeProviderStatus.publishableKeyMasked) {
    map.PUBLISHABLE_KEY = runtimeProviderStatus.publishableKeyMasked
  }

  if (!map.SECRET_KEY && runtimeProviderStatus.secretKeyMasked) {
    map.SECRET_KEY = runtimeProviderStatus.secretKeyMasked
  }

  if (!map.WEBHOOK_SECRET && runtimeProviderStatus.webhookSecretMasked) {
    map.WEBHOOK_SECRET = runtimeProviderStatus.webhookSecretMasked
  }

  const normalizedMode = String(map.MODE || runtimeProviderStatus.mode || input.runtimeMode || '')
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
