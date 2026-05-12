export const SUPPORTED_STORE_CURRENCIES = ['USD', 'CAD', 'GBP', 'EUR', 'AUD'] as const

export type SupportedStoreCurrency = (typeof SUPPORTED_STORE_CURRENCIES)[number]

export const STORE_CURRENCY_OPTIONS: Array<{ value: SupportedStoreCurrency; label: string }> = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
]

export const SUPPORTED_STORE_TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Australia/Sydney',
] as const

export type SupportedStoreTimeZone = (typeof SUPPORTED_STORE_TIMEZONES)[number]

export const STORE_TIMEZONE_OPTIONS: Array<{ value: SupportedStoreTimeZone; label: string }> = [
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Phoenix', label: 'Arizona' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Australia/Sydney', label: 'Sydney' },
]

export function isSupportedStoreCurrency(value: unknown): value is SupportedStoreCurrency {
  return SUPPORTED_STORE_CURRENCIES.includes(String(value || '').toUpperCase() as SupportedStoreCurrency)
}

export function isSupportedStoreTimeZone(value: unknown): value is SupportedStoreTimeZone {
  return SUPPORTED_STORE_TIMEZONES.includes(String(value || '') as SupportedStoreTimeZone)
}

export function normalizeStoreCurrency(value: unknown, fallback: SupportedStoreCurrency = 'USD'): SupportedStoreCurrency {
  const normalized = String(value || '').toUpperCase()
  return isSupportedStoreCurrency(normalized) ? normalized : fallback
}

export function normalizeStoreTimeZone(
  value: unknown,
  fallback: SupportedStoreTimeZone = 'America/New_York'
): SupportedStoreTimeZone {
  const normalized = String(value || '')
  return isSupportedStoreTimeZone(normalized) ? normalized : fallback
}
