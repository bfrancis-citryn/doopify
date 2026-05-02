import { postgresMediaStorageAdapter } from '@/server/media/postgres-media-storage'
import { createS3MediaStorageAdapter, type S3MediaStorageConfig } from '@/server/media/s3-media-storage'
import type { MediaStorageAdapter } from '@/server/media/storage-adapter'

let cachedS3Adapter: MediaStorageAdapter | null = null

function getS3ConfigFromEnv(): S3MediaStorageConfig | null {
  const endpoint = process.env.MEDIA_S3_ENDPOINT?.trim() || undefined
  const region = process.env.MEDIA_S3_REGION?.trim()
  const bucket = process.env.MEDIA_S3_BUCKET?.trim()
  const accessKeyId = process.env.MEDIA_S3_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.MEDIA_S3_SECRET_ACCESS_KEY?.trim()
  const publicBaseUrl = process.env.MEDIA_PUBLIC_BASE_URL?.trim() || undefined

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    return null
  }

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  }
}

export function getMediaStorageAdapter(): MediaStorageAdapter {
  const provider = process.env.MEDIA_STORAGE_PROVIDER?.trim().toLowerCase()

  if (!provider || provider === 'postgres') {
    return postgresMediaStorageAdapter
  }

  if (provider === 's3') {
    const config = getS3ConfigFromEnv()
    if (!config) {
      console.warn(
        '[media-storage] MEDIA_STORAGE_PROVIDER=s3 is configured without required MEDIA_S3_* values. Falling back to Postgres storage.'
      )
      return postgresMediaStorageAdapter
    }

    cachedS3Adapter ??= createS3MediaStorageAdapter(config)
    return cachedS3Adapter
  }

  console.warn(`[media-storage] MEDIA_STORAGE_PROVIDER=${provider} is unsupported. Falling back to Postgres storage.`)
  return postgresMediaStorageAdapter
}

export function getMediaPublicUrl(assetId: string) {
  return getMediaStorageAdapter().getPublicUrl(assetId)
}

export function resetMediaStorageAdapterCacheForTests() {
  cachedS3Adapter = null
}
