import { err, ok, parseBody } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/server/auth/require-auth'
import { NextResponse } from 'next/server'

interface Params {
  params: Promise<{ assetId: string }>
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { assetId } = await params
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: assetId },
      select: { data: true, mimeType: true, filename: true },
    })
    if (!asset) return err('Asset not found', 404)

    return new NextResponse(asset.data, {
      status: 200,
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Disposition': `inline; filename="${asset.filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    console.error('[GET /api/media/[assetId]]', e)
    return err('Failed to fetch asset', 500)
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = await parseBody<{ altText?: string }>(req)
  if (!body) return err('Invalid request body')

  try {
    const { assetId } = await params
    const asset = await prisma.mediaAsset.update({
      where: { id: assetId },
      data: {
        altText: body.altText?.trim() || null,
      },
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
      id: asset.id,
      filename: asset.filename,
      altText: asset.altText,
      mimeType: asset.mimeType,
      size: asset.size,
      createdAt: asset.createdAt,
      linkedProducts: asset._count.productMedia,
      products: asset.productMedia.map((media) => media.product),
      url: `/api/media/${asset.id}`,
    })
  } catch (e) {
    console.error('[PATCH /api/media/[assetId]]', e)
    return err('Failed to update asset metadata', 500)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin(_req)
  if (!auth.ok) return auth.response

  try {
    const { assetId } = await params
    await prisma.mediaAsset.delete({ where: { id: assetId } })
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.error('[DELETE /api/media/[assetId]]', e)
    return err('Failed to delete asset', 500)
  }
}
