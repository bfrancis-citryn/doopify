import { describe, expect, it } from 'vitest'

import { formatDateTimeForDisplay, resolveSafeTimeZone } from './date-time-format'

describe('date-time-format', () => {
  it('uses provided timezone when valid', () => {
    const iso = '2026-01-01T01:00:00.000Z'

    const utcText = formatDateTimeForDisplay(iso, { timeZone: 'UTC' })
    const pacificText = formatDateTimeForDisplay(iso, { timeZone: 'America/Los_Angeles' })

    expect(utcText).toContain('2026')
    expect(pacificText).toContain('2025')
    expect(utcText).not.toBe(pacificText)
  })

  it('falls back safely when timezone is invalid', () => {
    const iso = '2026-01-01T01:00:00.000Z'

    const invalidTimeZoneText = formatDateTimeForDisplay(iso, { timeZone: 'Not/A-Timezone' })
    const defaultText = formatDateTimeForDisplay(iso)

    expect(invalidTimeZoneText).toBe(defaultText)
  })

  it('returns fallback text when date input is invalid', () => {
    expect(formatDateTimeForDisplay('not-a-date', { fallbackText: 'Unknown' })).toBe('Unknown')
  })

  it('validates timezone names safely', () => {
    expect(resolveSafeTimeZone('America/New_York')).toBe('America/New_York')
    expect(resolveSafeTimeZone('Invalid/TZ')).toBeUndefined()
  })
})
