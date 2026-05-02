import { ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/server/auth/require-auth'
import { getMediaPublicUrl } from '@/server/media/media-storage'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') || 48), 1), 100)
    const search = searchParams.get('search')?.trim()

    const assets = await prisma.mediaAsset.findMany({
      where: search
        ? {
            OR: [
              { filename: { contains: search, mode: 'insensitive' } },
              { altText: { contains: search, mode: 'insensitive' } },
              { productMedia: { some: { product: { title: { contains: search, mode: 'insensitive' } } } } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      select: {
        id: true,
        filename: true,
        altText: true,
        mimeType: true,
        size: true,
        createdAt: true,
        productMedia: {
          orderBy: { position: 'asc' },
          take: 4,
          select: {
            product: {
              select: {
                id: true,
                title: true,
                handle: true,
              },
            },
          },
        },
        _count: {
          select: {
            productMedia: true,
          },
        },
      },
    })

    return ok({
      assets: assets.map((asset) => ({
        id: asset.id,
        filename: asset.filename,
        altText: asset.altText,
        mimeType: asset.mimeType,
        size: asset.size,
        createdAt: asset.createdAt,
        linkedProducts: asset._count.productMedia,
        products: asset.productMedia.map((media) => media.product),
        url: getMediaPublicUrl(asset.id),
      })),
    })
  } catch (e) {
    console.error('[GET /api/media]', e)
    return err('Failed to fetch media library', 500)
  }
}
