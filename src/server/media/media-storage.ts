import { postgresMediaStorageAdapter } from '@/server/media/postgres-media-storage'
import type { MediaStorageAdapter } from '@/server/media/storage-adapter'

export function getMediaStorageAdapter(): MediaStorageAdapter {
  const provider = process.env.MEDIA_STORAGE_PROVIDER?.trim().toLowerCase()

  if (!provider || provider === 'postgres') {
    return postgresMediaStorageAdapter
  }

  console.warn(
    `[media-storage] MEDIA_STORAGE_PROVIDER=${provider} is not implemented yet. Falling back to Postgres storage.`
  )
  return postgresMediaStorageAdapter
}

export function getMediaPublicUrl(assetId: string) {
  return getMediaStorageAdapter().getPublicUrl(assetId)
}
