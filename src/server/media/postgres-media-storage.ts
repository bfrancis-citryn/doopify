import { prisma } from '@/lib/prisma'
import {
  PUBLIC_MEDIA_CACHE_CONTROL,
  type GetMediaObjectResult,
  type MediaStorageAdapter,
  type PutMediaObjectInput,
  type PutMediaObjectResult,
} from '@/server/media/storage-adapter'

function mediaUrl(assetId: string) {
  return `/api/media/${assetId}`
}

export const postgresMediaStorageAdapter: MediaStorageAdapter = {
  provider: 'postgres',

  async put(input: PutMediaObjectInput): Promise<PutMediaObjectResult> {
    const asset = await prisma.mediaAsset.create({
      data: {
        filename: input.filename,
        altText: input.altText || undefined,
        mimeType: input.mimeType,
        size: input.size,
        data: input.buffer,
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

    return {
      id: asset.id,
      provider: 'postgres',
      url: mediaUrl(asset.id),
      filename: asset.filename,
      altText: asset.altText,
      mimeType: asset.mimeType,
      size: asset.size,
      createdAt: asset.createdAt,
      linkedProducts: input.productId ? 1 : 0,
    }
  },

  async get(assetId: string): Promise<GetMediaObjectResult | null> {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        data: true,
        mimeType: true,
        filename: true,
        size: true,
      },
    })

    if (!asset) return null

    return {
      body: Buffer.from(asset.data),
      mimeType: asset.mimeType,
      filename: asset.filename,
      size: asset.size,
      cacheControl: PUBLIC_MEDIA_CACHE_CONTROL,
    }
  },

  async delete(assetId: string): Promise<void> {
    await prisma.mediaAsset.delete({ where: { id: assetId } })
  },

  getPublicUrl(assetId: string) {
    return mediaUrl(assetId)
  },
}
