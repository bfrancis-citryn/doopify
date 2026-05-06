import { describe, expect, it } from 'vitest'

import { normalizeSettingsSessionUser } from './settings-session-user.helpers'

describe('settings session user helper', () => {
  it('returns null for missing or malformed payloads to avoid account tab crashes', () => {
    expect(normalizeSettingsSessionUser(null)).toBeNull()
    expect(normalizeSettingsSessionUser({})).toBeNull()
    expect(normalizeSettingsSessionUser({ email: 'owner@example.com' })).toBeNull()
  })

  it('returns a normalized user shape for valid /api/auth/me payloads', () => {
    expect(
      normalizeSettingsSessionUser({
        id: 'usr_1',
        email: 'owner@example.com',
        role: 'OWNER',
        firstName: 'Owner',
        lastName: 'User',
      })
    ).toEqual({
      id: 'usr_1',
      email: 'owner@example.com',
      role: 'OWNER',
      firstName: 'Owner',
      lastName: 'User',
    })
  })
})
