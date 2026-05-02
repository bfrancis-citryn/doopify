import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  deleteAsset: vi.fn(),
}))

vi.mock('@/server/auth/require-auth', () => ({
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('@/server/media/media-storage', () => ({
  getMediaStorageAdapter: () => ({
    provider: 'postgres',
    put: vi.fn(),
    get: vi.fn(),
    delete: mocks.deleteAsset,
    getPublicUrl: (assetId: string) => `/api/media/${assetId}`,
  }),
}))

import { DELETE } from './route'

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
