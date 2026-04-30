import { describe, expect, it } from 'vitest'
import { getComputedProductState, getComputedProductStateMeta, isFuturePublishDate } from './productUtils'

describe('product lifecycle state helpers', () => {
  it('marks active products with a future publish date as scheduled', () => {
    const now = new Date('2026-04-30T12:00:00.000Z')
    const futureDate = '2026-05-01T10:00:00.000Z'

    expect(isFuturePublishDate(futureDate, now)).toBe(true)
    expect(
      getComputedProductState(
        {
          status: 'active',
          publishedAt: futureDate,
        },
        now
      )
    ).toBe('scheduled')
    expect(
      getComputedProductStateMeta(
        {
          status: 'active',
          publishedAt: futureDate,
        },
        now
      )
    ).toEqual({
      state: 'scheduled',
      label: 'Scheduled',
      tone: 'info',
    })
  })

  it('keeps archived precedence and treats future publish dates as scheduled', () => {
    const now = new Date('2026-04-30T12:00:00.000Z')
    const futureDate = '2026-05-01T10:00:00.000Z'

    expect(getComputedProductState({ status: 'archived', publishedAt: futureDate }, now)).toBe('archived')
    expect(getComputedProductState({ status: 'draft', publishedAt: futureDate }, now)).toBe('scheduled')
  })
})
