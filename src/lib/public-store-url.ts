export type PublicStoreUrlIssue =
  | 'missing'
  | 'invalid'
  | 'placeholder'
  | 'localhost_production'

export type PublicStoreUrlEvaluation = {
  normalizedBaseUrl: string | null
  valid: boolean
  ready: boolean
  issue: PublicStoreUrlIssue | null
  message: string
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const PLACEHOLDER_SUBSTRINGS = [
  'your-doopify-beta-domain',
  'your-domain',
  '<your-domain>',
  'replace_me',
  'replace-with',
  'replace_with',
]

function trimToNull(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function isHttpProtocol(protocol: string) {
  return protocol === 'http:' || protocol === 'https:'
}

function hasPlaceholderPattern(hostname: string, rawValue: string) {
  const host = hostname.toLowerCase()
  const value = rawValue.toLowerCase()

  if (host.startsWith('your-') || host.includes('your-domain')) {
    return true
  }

  return PLACEHOLDER_SUBSTRINGS.some((token) => value.includes(token))
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export function evaluatePublicStoreUrl(input: {
  value?: string | null
  nodeEnv?: string | null
}): PublicStoreUrlEvaluation {
  const raw = trimToNull(input.value)
  if (!raw) {
    return {
      normalizedBaseUrl: null,
      valid: false,
      ready: false,
      issue: 'missing',
      message: 'NEXT_PUBLIC_STORE_URL is missing.',
    }
  }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return {
      normalizedBaseUrl: null,
      valid: false,
      ready: false,
      issue: 'invalid',
      message: 'NEXT_PUBLIC_STORE_URL is not a valid HTTP(S) URL.',
    }
  }

  if (!isHttpProtocol(parsed.protocol)) {
    return {
      normalizedBaseUrl: null,
      valid: false,
      ready: false,
      issue: 'invalid',
      message: 'NEXT_PUBLIC_STORE_URL must use http:// or https://.',
    }
  }

  const baseUrl = stripTrailingSlash(parsed.toString())

  if (hasPlaceholderPattern(parsed.hostname, raw)) {
    return {
      normalizedBaseUrl: baseUrl,
      valid: true,
      ready: false,
      issue: 'placeholder',
      message: 'NEXT_PUBLIC_STORE_URL is still using a placeholder domain.',
    }
  }

  const isProduction = String(input.nodeEnv || '').toLowerCase() === 'production'
  if (isProduction && LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    return {
      normalizedBaseUrl: baseUrl,
      valid: true,
      ready: false,
      issue: 'localhost_production',
      message: 'NEXT_PUBLIC_STORE_URL cannot be localhost in production.',
    }
  }

  return {
    normalizedBaseUrl: baseUrl,
    valid: true,
    ready: true,
    issue: null,
    message: 'NEXT_PUBLIC_STORE_URL is configured.',
  }
}

export function buildStripeWebhookEndpoint(baseUrl: string) {
  return `${stripTrailingSlash(baseUrl)}/api/webhooks/stripe`
}

export function resolveStripeWebhookEndpoint(input: {
  nextPublicStoreUrl?: string | null
  currentOrigin?: string | null
  nodeEnv?: string | null
}) {
  const envEvaluation = evaluatePublicStoreUrl({
    value: input.nextPublicStoreUrl,
    nodeEnv: input.nodeEnv,
  })

  const originEvaluation = evaluatePublicStoreUrl({
    value: input.currentOrigin,
    nodeEnv: 'development',
  })

  const endpointBaseUrl =
    (envEvaluation.ready ? envEvaluation.normalizedBaseUrl : null) ||
    originEvaluation.normalizedBaseUrl ||
    null

  return {
    endpointUrl: endpointBaseUrl
      ? buildStripeWebhookEndpoint(endpointBaseUrl)
      : null,
    endpointSource: envEvaluation.normalizedBaseUrl
      ? 'env'
      : originEvaluation.normalizedBaseUrl
        ? 'origin'
        : 'none',
    ready: envEvaluation.ready,
    issue: envEvaluation.issue,
    message: envEvaluation.message,
  }
}
