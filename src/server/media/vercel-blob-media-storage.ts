import { del, put } from '@vercel/blob'

import { prisma } from '@/lib/prisma'
import {
  PUBLIC_MEDIA_CACHE_CONTROL,
  type GetMediaObjectResult,
  type MediaStorageAdapter,
  type PutMediaObjectInput,
  type PutMediaObjectResult,
} from '@/server/media/storage-adapter'

export type VercelBlobMediaStorageConfig = {
  token: string
}

type BlobPutResult = {
  url: string
  pathname: string
}

type PrismaMediaAssetCreateResult = {
  id: string
  filename: string
  altText: string | null
  mimeType: string
  size: number | null
  createdAt: Date
}

type PrismaMediaAssetReadResult = {
  id: string
  storageProvider: string
  storageKey: string | null
  publicUrl: string | null
  storageBucket: string | null
  filename: string
  mimeType: string
  size: number | null
}

type PrismaMediaClient = {
  mediaAsset: {
    create(args: unknown): Promise<PrismaMediaAssetCreateResult>
    update(args: unknown): Promise<PrismaMediaAssetCreateResult>
    findUnique(args: unknown): Promise<PrismaMediaAssetReadResult | null>
    delete(args: unknown): Promise<unknown>
  }
}

type VercelBlobMediaAdapterDeps = {
  prismaClient: PrismaMediaClient
  putObject: (
    pathname: string,
    body: Buffer,
    options: {
      access: 'public'
      addRandomSuffix: boolean
      contentType: string
      token: string
      cacheControlMaxAge?: number
    }
  ) => Promise<BlobPutResult>
  deleteObject: (urlOrPathname: string, options: { token: string }) => Promise<void>
}

function mediaUrl(assetId: string) {
  return `/api/media/${assetId}`
}

function sanitizeFilename(filename: string) {
  const dotIndex = filename.lastIndexOf('.')
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  const ext = dotIndex > 0 ? filename.slice(dotIndex + 1) : ''

  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const safeExt = ext
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  const finalBase = safeBase || 'asset'
  return safeExt ? `${finalBase}.${safeExt}` : finalBase
}

export function buildVercelBlobStorageKey(assetId: string, filename: string) {
  return `media/${assetId}/${sanitizeFilename(filename)}`
}

export function createVercelBlobMediaStorageAdapter(
  config: VercelBlobMediaStorageConfig,
  deps: VercelBlobMediaAdapterDeps = {
    prismaClient: prisma as unknown as PrismaMediaClient,
    putObject: async (pathname, body, options) => {
      const result = await put(pathname, body, options)
      return {
        url: result.url,
        pathname: result.pathname,
      }
    },
    deleteObject: async (urlOrPathname, options) => {
      await del(urlOrPathname, options)
    },
  }
): MediaStorageAdapter {
  return {
    provider: 'vercel-blob',

    async put(input: PutMediaObjectInput): Promise<PutMediaObjectResult> {
      const created = await deps.prismaClient.mediaAsset.create({
        data: {
          filename: input.filename,
          altText: input.altText || undefined,
          mimeType: input.mimeType,
          size: input.size,
          data: null,
          storageProvider: 'vercel-blob',
          storageBucket: null,
          ...(input.productId && {
            productMedia: {
              create: {
                productId: input.productId,
                position: 0,
              },
            },
          }),
        },
      })

      const path = buildVercelBlobStorageKey(created.id, input.filename)

      let blobResult: BlobPutResult
      try {
        blobResult = await deps.putObject(path, input.buffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType: input.mimeType,
          token: config.token,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
        })
      } catch (error) {
        try {
          await deps.prismaClient.mediaAsset.delete({ where: { id: created.id } })
        } catch (cleanupError) {
          console.error('[media-storage] Failed to cleanup blob media metadata after put failure', cleanupError)
        }
        throw error
      }

      const saved = await deps.prismaClient.mediaAsset.update({
        where: { id: created.id },
        data: {
          storageKey: blobResult.pathname.replace(/^\/+/, ''),
          publicUrl: blobResult.url,
          storageBucket: null,
        },
      })

      return {
        id: saved.id,
        provider: 'vercel-blob',
        url: mediaUrl(saved.id),
        filename: saved.filename,
        altText: saved.altText,
        mimeType: saved.mimeType,
        size: saved.size,
        createdAt: saved.createdAt,
        linkedProducts: input.productId ? 1 : 0,
      }
    },

    async get(assetId: string): Promise<GetMediaObjectResult | null> {
      const asset = await deps.prismaClient.mediaAsset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          storageProvider: true,
          storageKey: true,
          publicUrl: true,
          storageBucket: true,
          filename: true,
          mimeType: true,
          size: true,
        },
      })

      if (!asset) {
        return null
      }

      if (asset.storageProvider !== 'vercel-blob') {
        throw new Error(`Vercel Blob adapter cannot read non-blob media asset ${asset.id}`)
      }

      if (!asset.publicUrl) {
        throw new Error(`Blob media asset ${asset.id} is missing public URL metadata`)
      }

      return {
        redirectUrl: asset.publicUrl,
        mimeType: asset.mimeType,
        filename: asset.filename,
        size: asset.size,
        cacheControl: PUBLIC_MEDIA_CACHE_CONTROL,
      }
    },

    async delete(assetId: string): Promise<void> {
      const asset = await deps.prismaClient.mediaAsset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          storageProvider: true,
          storageKey: true,
          publicUrl: true,
          storageBucket: true,
          filename: true,
          mimeType: true,
          size: true,
        },
      })

      if (!asset) {
        throw new Error('Asset not found')
      }

      if (asset.storageProvider !== 'vercel-blob') {
        throw new Error(`Vercel Blob adapter cannot delete non-blob media asset ${asset.id}`)
      }

      const objectTarget = asset.publicUrl || asset.storageKey
      if (!objectTarget) {
        throw new Error(`Blob media asset ${asset.id} is missing object location metadata`)
      }

      await deps.deleteObject(objectTarget, { token: config.token })
      await deps.prismaClient.mediaAsset.delete({ where: { id: asset.id } })
    },

    getPublicUrl(assetId: string) {
      return mediaUrl(assetId)
    },
  }
}
