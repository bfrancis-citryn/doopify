import { afterEach, describe, expect, it, vi } from 'vitest'

import { getMediaPublicUrl, getMediaStorageAdapter, resetMediaStorageAdapterCacheForTests } from './media-storage'

describe('media storage resolver', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    resetMediaStorageAdapterCacheForTests()
  })

  it('defaults to Postgres storage when no provider is configured', () => {
    vi.stubEnv('MEDIA_STORAGE_PROVIDER', '')

    expect(getMediaStorageAdapter().provider).toBe('postgres')
  })

  it('uses Postgres storage when explicitly configured', () => {
    vi.stubEnv('MEDIA_STORAGE_PROVIDER', 'postgres')

    expect(getMediaStorageAdapter().provider).toBe('postgres')
  })

  it('falls back to Postgres storage when s3 is configured without required env vars', () => {
    vi.stubEnv('MEDIA_STORAGE_PROVIDER', 's3')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(getMediaStorageAdapter().provider).toBe('postgres')
    expect(warnSpy).toHaveBeenCalledWith(
      '[media-storage] MEDIA_STORAGE_PROVIDER=s3 is configured without required MEDIA_S3_* values. Falling back to Postgres storage.'
    )

    warnSpy.mockRestore()
  })

  it('uses s3 storage when provider and required env vars are configured', () => {
    vi.stubEnv('MEDIA_STORAGE_PROVIDER', 's3')
    vi.stubEnv('MEDIA_S3_REGION', 'auto')
    vi.stubEnv('MEDIA_S3_BUCKET', 'doopify-media')
    vi.stubEnv('MEDIA_S3_ACCESS_KEY_ID', 'key')
    vi.stubEnv('MEDIA_S3_SECRET_ACCESS_KEY', 'secret')

    expect(getMediaStorageAdapter().provider).toBe('s3')
  })

  it('uses legacy MEDIA_S3_PUBLIC_URL as fallback and warns once', () => {
    vi.stubEnv('MEDIA_STORAGE_PROVIDER', 's3')
    vi.stubEnv('MEDIA_S3_REGION', 'auto')
    vi.stubEnv('MEDIA_S3_BUCKET', 'doopify-media')
    vi.stubEnv('MEDIA_S3_ACCESS_KEY_ID', 'key')
    vi.stubEnv('MEDIA_S3_SECRET_ACCESS_KEY', 'secret')
    vi.stubEnv('MEDIA_S3_PUBLIC_URL', 'https://legacy-cdn.example.com/media')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(getMediaStorageAdapter().provider).toBe('s3')
    expect(warnSpy).toHaveBeenCalledWith(
      '[media-storage] MEDIA_S3_PUBLIC_URL is deprecated. Use MEDIA_PUBLIC_BASE_URL instead.'
    )

    warnSpy.mockClear()
    expect(getMediaStorageAdapter().provider).toBe('s3')
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('prefers MEDIA_PUBLIC_BASE_URL over legacy MEDIA_S3_PUBLIC_URL without warning', () => {
    vi.stubEnv('MEDIA_STORAGE_PROVIDER', 's3')
    vi.stubEnv('MEDIA_S3_REGION', 'auto')
    vi.stubEnv('MEDIA_S3_BUCKET', 'doopify-media')
    vi.stubEnv('MEDIA_S3_ACCESS_KEY_ID', 'key')
    vi.stubEnv('MEDIA_S3_SECRET_ACCESS_KEY', 'secret')
    vi.stubEnv('MEDIA_PUBLIC_BASE_URL', 'https://cdn.example.com/media')
    vi.stubEnv('MEDIA_S3_PUBLIC_URL', 'https://legacy-cdn.example.com/media')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(getMediaStorageAdapter().provider).toBe('s3')
    expect(warnSpy).not.toHaveBeenCalledWith(
      '[media-storage] MEDIA_S3_PUBLIC_URL is deprecated. Use MEDIA_PUBLIC_BASE_URL instead.'
    )
    warnSpy.mockRestore()
  })

  it('falls back to Postgres for unsupported providers', () => {
    vi.stubEnv('MEDIA_STORAGE_PROVIDER', 'r2')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(getMediaStorageAdapter().provider).toBe('postgres')
    expect(warnSpy).toHaveBeenCalledWith(
      '[media-storage] MEDIA_STORAGE_PROVIDER=r2 is unsupported. Falling back to Postgres storage.'
    )
    warnSpy.mockRestore()
  })

  it('returns stable app media URLs', () => {
    expect(getMediaPublicUrl('asset_123')).toBe('/api/media/asset_123')
  })
})
