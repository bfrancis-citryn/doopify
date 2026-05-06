type CredentialMetaEntry = {
  key: string
  present?: boolean
  maskedValue?: string | null
}

export function buildMaskedCredentialMap(entries: CredentialMetaEntry[] | null | undefined) {
  const map: Record<string, string> = {}
  for (const entry of entries || []) {
    if (!entry?.key || !entry?.present || !entry.maskedValue) continue
    map[entry.key] = entry.maskedValue
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
