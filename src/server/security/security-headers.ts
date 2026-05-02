import type { NextResponse } from 'next/server'

type CspMode = 'off' | 'report-only' | 'enforce'

type RuntimeEnvironment = 'development' | 'production' | 'test'

export type SecurityHeaderOptions = {
  environment?: RuntimeEnvironment
  cspMode?: CspMode
  mediaOrigins?: string[]
  analyticsOrigins?: string[]
}

const DEFAULT_MEDIA_ORIGINS = ['https:']
const STRIPE_SCRIPT_ORIGINS = ['https://js.stripe.com']
const STRIPE_CONNECT_ORIGINS = ['https://api.stripe.com', 'https://*.stripe.com']
const STRIPE_FRAME_ORIGINS = ['https://js.stripe.com', 'https://hooks.stripe.com']

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function parseOrigins(value: string | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function resolveEnvironment(value = process.env.NODE_ENV): RuntimeEnvironment {
  if (value === 'production' || value === 'test') return value
  return 'development'
}

function resolveCspMode(environment: RuntimeEnvironment, explicitMode?: CspMode): CspMode {
  if (explicitMode) return explicitMode

  const envMode = process.env.CSP_MODE as CspMode | undefined
  if (envMode === 'off' || envMode === 'report-only' || envMode === 'enforce') {
    return envMode
  }

  return environment === 'production' ? 'report-only' : 'off'
}

function buildCsp(options: Required<Pick<SecurityHeaderOptions, 'mediaOrigins' | 'analyticsOrigins'>> & {
  environment: RuntimeEnvironment
}) {
  const scriptSources = unique([
    "'self'",
    "'unsafe-inline'",
    ...(options.environment === 'development' ? ["'unsafe-eval'"] : []),
    ...STRIPE_SCRIPT_ORIGINS,
  ])
  const styleSources = unique(["'self'", "'unsafe-inline'"])
  const imageSources = unique(["'self'", 'data:', 'blob:', ...options.mediaOrigins])
  const connectSources = unique([
    "'self'",
    ...STRIPE_CONNECT_ORIGINS,
    ...options.analyticsOrigins,
    ...(options.environment === 'development' ? ['ws:', 'wss:'] : []),
  ])
  const frameSources = unique(STRIPE_FRAME_ORIGINS)

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSources.join(' ')}`,
    `script-src-elem ${scriptSources.join(' ')}`,
    `style-src ${styleSources.join(' ')}`,
    `style-src-elem ${styleSources.join(' ')}`,
    `img-src ${imageSources.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    `frame-src ${frameSources.join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(options.environment === 'production' ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

export function buildSecurityHeaders(options: SecurityHeaderOptions = {}) {
  const environment = resolveEnvironment(options.environment)
  const cspMode = resolveCspMode(environment, options.cspMode)
  const securityHeadersEnabled = process.env.SECURITY_HEADERS_ENABLED !== 'false'

  if (!securityHeadersEnabled) {
    return new Headers()
  }

  const headers = new Headers()
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self), usb=(), serial=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=(), fullscreen=(self)'
  )

  if (environment === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  if (cspMode !== 'off') {
    const csp = buildCsp({
      environment,
      mediaOrigins: options.mediaOrigins ?? parseOrigins(process.env.CSP_MEDIA_ORIGINS) ?? DEFAULT_MEDIA_ORIGINS,
      analyticsOrigins: options.analyticsOrigins ?? parseOrigins(process.env.CSP_ANALYTICS_ORIGINS),
    })
    headers.set(
      cspMode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
      csp
    )
  }

  return headers
}

export function applySecurityHeaders<TResponse extends NextResponse>(
  response: TResponse,
  options: SecurityHeaderOptions = {}
) {
  const headers = buildSecurityHeaders(options)
  headers.forEach((value, key) => {
    response.headers.set(key, value)
  })
  return response
}
