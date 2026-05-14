import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  deleteAsset: vi.fn(),
  getAsset: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/media/media-storage', () => ({
  getMediaStorageAdapter: () => ({
    provider: 'postgres',
    put: vi.fn(),
    get: mocks.getAsset,
    delete: mocks.deleteAsset,
    getPublicUrl: (assetId: string) => `/api/media/${assetId}`,
  }),
  getMediaPublicUrl: (assetId: string) => `/api/media/${assetId}`,
}))

import { DELETE, GET } from './route'

describe('GET /api/media/[assetId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAsset.mockResolvedValue({
      redirectUrl: 'https://blob.vercel-storage.com/media/asset_1/image.png',
      mimeType: 'image/png',
      filename: 'image.png',
      size: 1024,
      cacheControl: 'public, max-age=31536000, immutable',
    })
  })

  it('redirects to publicUrl for object-stored assets', async () => {
    const response = await GET(new Request('http://localhost/api/media/asset_1'), {
      params: Promise.resolve({ assetId: 'asset_1' }),
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://blob.vercel-storage.com/media/asset_1/image.png')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  })
})

describe('DELETE /api/media/[assetId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'admin_1', email: 'admin@example.com', role: 'OWNER' },
    })
    mocks.deleteAsset.mockResolvedValue(undefined)
  })

  it('calls the storage adapter delete method', async () => {
    const response = await DELETE(new Request('http://localhost/api/media/asset_1', { method: 'DELETE' }), {
      params: Promise.resolve({ assetId: 'asset_1' }),
    })

    expect(response.status).toBe(204)
    expect(mocks.deleteAsset).toHaveBeenCalledWith('asset_1')
  })

  it('returns a safe failure response when storage delete fails', async () => {
    mocks.deleteAsset.mockRejectedValue(new Error('delete failed'))

    const response = await DELETE(new Request('http://localhost/api/media/asset_1', { method: 'DELETE' }), {
      params: Promise.resolve({ assetId: 'asset_1' }),
    })
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json).toMatchObject({
      success: false,
      error: 'Failed to delete asset',
    })
  })
})
