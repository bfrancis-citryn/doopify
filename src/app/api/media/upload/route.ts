import { ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const productId = formData.get('productId') as string | null
    const altText = formData.get('altText') as string | null

    if (!file) return err('No file provided')
    if (!ALLOWED_TYPES.includes(file.type)) return err('File type not allowed. Use JPEG, PNG, WebP, GIF or SVG.')
    if (file.size > MAX_SIZE) return err('File too large. Maximum size is 10 MB.')

    const buffer = Buffer.from(await file.arrayBuffer())

    const asset = await prisma.mediaAsset.create({
      data: {
        filename: file.name,
        altText: altText || undefined,
        mimeType: file.type,
        size: file.size,
        data: buffer,
        ...(productId && {
          productMedia: {
            create: {
              productId,
              position: 0,
            },
          },
        }),
      },
    })

    // Return asset shape with a URL the frontend can use to display the image
    return ok({
      id: asset.id,
      url: `/api/media/${asset.id}`,
      filename: asset.filename,
      altText: asset.altText,
      mimeType: asset.mimeType,
      size: asset.size,
      createdAt: asset.createdAt,
      linkedProducts: productId ? 1 : 0,
    }, 201)
  } catch (e) {
    console.error('[POST /api/media/upload]', e)
    return err('Failed to upload file', 500)
  }
}
