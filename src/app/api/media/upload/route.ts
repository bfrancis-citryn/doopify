import { ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/server/auth/require-auth'
import { getMediaStorageAdapter } from '@/server/media/media-storage'

export const runtime = 'nodejs'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function detectMimeType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif'
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }

  return null
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const productId = formData.get('productId') as string | null
    const altText = formData.get('altText') as string | null

    if (!file) return err('No file provided')
    if (file.size > MAX_SIZE) return err('File too large. Maximum size is 10 MB.')

    const buffer = Buffer.from(await file.arrayBuffer())
    const detectedMimeType = detectMimeType(buffer)

    if (!detectedMimeType || !ALLOWED_TYPES.includes(detectedMimeType)) {
      return err('File type not allowed. Use JPEG, PNG, WebP, or GIF.')
    }

    if (file.type && file.type !== detectedMimeType) {
      return err('Uploaded file type does not match its contents.')
    }

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      })

      if (!product) {
        return err('Product not found', 404)
      }
    }

    const asset = await getMediaStorageAdapter().put({
      filename: file.name,
      altText,
      mimeType: detectedMimeType,
      size: file.size,
      buffer,
      productId,
    })

    return ok({
      id: asset.id,
      url: asset.url,
      filename: asset.filename,
      altText: asset.altText,
      mimeType: asset.mimeType,
      size: asset.size,
      createdAt: asset.createdAt,
      linkedProducts: asset.linkedProducts,
    }, 201)
  } catch (e) {
    console.error('[POST /api/media/upload]', e)
    return err('Failed to upload file', 500)
  }
}
