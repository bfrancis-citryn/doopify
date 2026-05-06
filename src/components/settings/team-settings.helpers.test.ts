import { describe, expect, it } from 'vitest'

import {
  getTeamAccessNotice,
  isKnownNonOwnerRole,
  isOwnerRole,
} from './team-settings.helpers'

describe('team settings helpers', () => {
  it('marks owner role as elevated access', () => {
    expect(isOwnerRole('OWNER')).toBe(true)
    expect(isKnownNonOwnerRole('OWNER')).toBe(false)
    expect(getTeamAccessNotice('OWNER')).toBe('')
  })

  it('marks non-owner roles as restricted', () => {
    expect(isOwnerRole('STAFF')).toBe(false)
    expect(isKnownNonOwnerRole('STAFF')).toBe(true)
    expect(getTeamAccessNotice('STAFF')).toContain('owner-only')
  })

  it('keeps unknown role neutral until session state is known', () => {
    expect(isKnownNonOwnerRole(undefined)).toBe(false)
    expect(getTeamAccessNotice(undefined)).toBe('')
  })
})
