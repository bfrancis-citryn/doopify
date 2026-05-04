import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  put: vi.fn(),
  findProduct: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/media/media-storage', () => ({
  getMediaStorageAdapter: () => ({
    provider: 'postgres',
    put: mocks.put,
    get: vi.fn(),
    delete: vi.fn(),
    getPublicUrl: (assetId: string) => `/api/media/${assetId}`,
  }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findUnique: mocks.findProduct,
    },
  },
}))

import { POST } from './route'

describe('POST /api/media/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'admin_1', email: 'admin@example.com', role: 'OWNER' },
    })
    mocks.findProduct.mockResolvedValue({ id: 'prod_1' })
    mocks.put.mockResolvedValue({
      id: 'asset_1',
      provider: 'postgres',
      url: '/api/media/asset_1',
      filename: 'asset.png',
      altText: 'Banner',
      mimeType: 'image/png',
      size: 68,
      createdAt: new Date('2026-05-02T12:00:00.000Z'),
      linkedProducts: 0,
    })
  })

  it('calls the media storage adapter for a valid upload', async () => {
    const pngBytes = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ])
    const formData = new FormData()
    formData.set('file', new File([pngBytes], 'asset.png', { type: 'image/png' }))
    formData.set('altText', 'Banner')

    const response = await POST(
      new Request('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData,
      })
    )

    const json = await response.json()

    expect(response.status).toBe(201)
    expect(mocks.put).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'asset.png',
        altText: 'Banner',
        mimeType: 'image/png',
      })
    )
    expect(json.success).toBe(true)
    expect(json.data).toMatchObject({
      id: 'asset_1',
      url: '/api/media/asset_1',
      mimeType: 'image/png',
    })
  })

  it('rejects request with no file', async () => {
    const formData = new FormData()
    const response = await POST(
      new Request('http://localhost/api/media/upload', { method: 'POST', body: formData })
    )
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toContain('No file')
  })

  it('rejects oversized file', async () => {
    const bigBuffer = new Uint8Array(11 * 1024 * 1024)
    bigBuffer[0] = 0x89; bigBuffer[1] = 0x50; bigBuffer[2] = 0x4e; bigBuffer[3] = 0x47
    bigBuffer[4] = 0x0d; bigBuffer[5] = 0x0a; bigBuffer[6] = 0x1a; bigBuffer[7] = 0x0a
    const formData = new FormData()
    formData.set('file', new File([bigBuffer], 'big.png', { type: 'image/png' }))

    const response = await POST(
      new Request('http://localhost/api/media/upload', { method: 'POST', body: formData })
    )
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toContain('10 MB')
  })

  it('rejects unsupported file type (SVG)', async () => {
    const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
    const formData = new FormData()
    formData.set('file', new File([svgBytes], 'icon.svg', { type: 'image/svg+xml' }))

    const response = await POST(
      new Request('http://localhost/api/media/upload', { method: 'POST', body: formData })
    )
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toContain('not allowed')
  })

  it('accepts a valid JPEG and returns 201', async () => {
    const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    const formData = new FormData()
    formData.set('file', new File([jpegBytes], 'photo.jpg', { type: 'image/jpeg' }))

    mocks.put.mockResolvedValue({
      id: 'asset_jpg',
      provider: 'postgres',
      url: '/api/media/asset_jpg',
      filename: 'photo.jpg',
      altText: null,
      mimeType: 'image/jpeg',
      size: jpegBytes.length,
      createdAt: new Date(),
      linkedProducts: 0,
    })

    const response = await POST(
      new Request('http://localhost/api/media/upload', { method: 'POST', body: formData })
    )
    const json = await response.json()
    expect(response.status).toBe(201)
    expect(json.data.mimeType).toBe('image/jpeg')
  })

  it('returns a safe failure response when storage upload fails', async () => {
    mocks.put.mockRejectedValue(new Error('storage offline'))

    const pngBytes = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ])
    const formData = new FormData()
    formData.set('file', new File([pngBytes], 'asset.png', { type: 'image/png' }))

    const response = await POST(
      new Request('http://localhost/api/media/upload', {
        method: 'POST',
        body: formData,
      })
    )
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json).toMatchObject({
      success: false,
      error: 'Failed to upload file',
    })
  })
})
