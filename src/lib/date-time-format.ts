type DateInput = Date | string | number | null | undefined

type DateDisplayOptions = Intl.DateTimeFormatOptions & {
  fallbackText?: string
  locale?: Intl.LocalesArgument
  timeZone?: string | null | undefined
}

export function resolveSafeTimeZone(value: string | null | undefined): string | undefined {
  const normalized = String(value || '').trim()
  if (!normalized) return undefined
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: normalized }).format(new Date())
    return normalized
  } catch {
    return undefined
  }
}

export function formatDateTimeForDisplay(value: DateInput, options: DateDisplayOptions = {}): string {
  const {
    fallbackText = 'Unknown',
    locale,
    timeZone,
    ...intlOptions
  } = options

  if (value == null || value === '') return fallbackText
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return fallbackText

  const formatterOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...intlOptions,
  }

  const safeTimeZone = resolveSafeTimeZone(timeZone)
  if (safeTimeZone) {
    formatterOptions.timeZone = safeTimeZone
  }

  return new Intl.DateTimeFormat(locale, formatterOptions).format(date)
}
