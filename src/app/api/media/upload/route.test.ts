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
