import { afterEach, describe, expect, it, vi } from 'vitest'

import { getMediaPublicUrl, getMediaStorageAdapter } from './media-storage'

describe('media storage resolver', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to Postgres storage when no provider is configured', () => {
    vi.stubEnv('MEDIA_STORAGE_PROVIDER', '')

    expect(getMediaStorageAdapter().provider).toBe('postgres')
  })

  it('uses Postgres storage when explicitly configured', () => {
    vi.stubEnv('MEDIA_STORAGE_PROVIDER', 'postgres')

    expect(getMediaStorageAdapter().provider).toBe('postgres')
  })

  it('falls back to Postgres storage for unimplemented providers', () => {
    vi.stubEnv('MEDIA_STORAGE_PROVIDER', 'r2')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(getMediaStorageAdapter().provider).toBe('postgres')
    expect(warnSpy).toHaveBeenCalledWith(
      '[media-storage] MEDIA_STORAGE_PROVIDER=r2 is not implemented yet. Falling back to Postgres storage.'
    )

    warnSpy.mockRestore()
  })

  it('returns stable app media URLs', () => {
    expect(getMediaPublicUrl('asset_123')).toBe('/api/media/asset_123')
  })
})
