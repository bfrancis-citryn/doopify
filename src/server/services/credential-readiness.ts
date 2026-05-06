const EXACT_PLACEHOLDERS = new Set([
  'sk_test_replace_me',
  'pk_test_replace_me',
  'whsec_replace_me',
  're_replace_me',
])

const PLACEHOLDER_SUBSTRINGS = [
  'replace_me',
  'replace-with',
  'replace_with',
  'example_key',
  'example_secret',
]

export function normalizeCredential(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

export function isPlaceholderCredential(value: unknown) {
  const normalized = normalizeCredential(value)?.toLowerCase()
  if (!normalized) return true
  if (EXACT_PLACEHOLDERS.has(normalized)) return true
  return PLACEHOLDER_SUBSTRINGS.some((token) => normalized.includes(token))
}

export function hasRealCredential(value: unknown) {
  const normalized = normalizeCredential(value)
  return Boolean(normalized) && !isPlaceholderCredential(normalized)
}
