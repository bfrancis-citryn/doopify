import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
}))

import {
  buildVercelBlobStorageKey,
  createVercelBlobMediaStorageAdapter,
} from './vercel-blob-media-storage'

function buildDeps(overrides?: {
  putObject?: ReturnType<typeof vi.fn>
  deleteObject?: ReturnType<typeof vi.fn>
  create?: ReturnType<typeof vi.fn>
  update?: ReturnType<typeof vi.fn>
  findUnique?: ReturnType<typeof vi.fn>
  deleteRecord?: ReturnType<typeof vi.fn>
}) {
  const putObject =
    overrides?.putObject ||
    vi.fn().mockResolvedValue({
      url: 'https://blob.vercel-storage.com/media/asset_blob/hero-image.png',
      pathname: 'media/asset_blob/hero-image.png',
    })
  const deleteObject = overrides?.deleteObject || vi.fn().mockResolvedValue(undefined)

  const create =
    overrides?.create ||
    vi.fn().mockResolvedValue({
      id: 'asset_blob',
      filename: 'Hero Image.PNG',
      altText: 'Hero image',
      mimeType: 'image/png',
      size: 6,
      createdAt: new Date('2026-05-13T15:00:00.000Z'),
    })

  const update =
    overrides?.update ||
    vi.fn().mockResolvedValue({
      id: 'asset_blob',
      filename: 'Hero Image.PNG',
      altText: 'Hero image',
      mimeType: 'image/png',
      size: 6,
      createdAt: new Date('2026-05-13T15:00:00.000Z'),
    })

  const findUnique =
    overrides?.findUnique ||
    vi.fn().mockResolvedValue({
      id: 'asset_blob',
      filename: 'Hero Image.PNG',
      mimeType: 'image/png',
      size: 6,
      storageProvider: 'vercel-blob',
      storageKey: 'media/asset_blob/hero-image.png',
      storageBucket: null,
      publicUrl: 'https://blob.vercel-storage.com/media/asset_blob/hero-image.png',
    })

  const deleteRecord = overrides?.deleteRecord || vi.fn().mockResolvedValue({ id: 'asset_blob' })

  return {
    putObject,
    deleteObject,
    create,
    update,
    findUnique,
    deleteRecord,
    deps: {
      putObject,
      deleteObject,
      prismaClient: {
        mediaAsset: {
          create,
          update,
          findUnique,
          delete: deleteRecord,
        },
      },
    },
  }
}

describe('vercel blob media storage adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates deterministic sanitized storage keys', () => {
    expect(buildVercelBlobStorageKey('asset_blob', 'Hero Image.PNG')).toBe('media/asset_blob/hero-image.png')
    expect(buildVercelBlobStorageKey('asset_blob', '__weird @@ name!!.webp')).toBe('media/asset_blob/weird-name.webp')
  })

  it('uploads and stores metadata with data=null and public URL', async () => {
    const mock = buildDeps()
    const adapter = createVercelBlobMediaStorageAdapter(
      { token: 'blob_rw_token' },
      mock.deps as any
    )

    const result = await adapter.put({
      filename: 'Hero Image.PNG',
      altText: 'Hero image',
      mimeType: 'image/png',
      size: 6,
      buffer: Buffer.from('binary'),
      productId: 'prod_1',
    })

    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storageProvider: 'vercel-blob',
          data: null,
        }),
      })
    )

    expect(mock.putObject).toHaveBeenCalledWith(
      'media/asset_blob/hero-image.png',
      expect.any(Buffer),
      expect.objectContaining({
        access: 'public',
        addRandomSuffix: false,
        contentType: 'image/png',
        token: 'blob_rw_token',
      })
    )

    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'asset_blob' },
        data: expect.objectContaining({
          storageKey: 'media/asset_blob/hero-image.png',
          publicUrl: 'https://blob.vercel-storage.com/media/asset_blob/hero-image.png',
          storageBucket: null,
        }),
      })
    )

    expect(result).toMatchObject({
      id: 'asset_blob',
      provider: 'vercel-blob',
      url: '/api/media/asset_blob',
      linkedProducts: 1,
    })
  })

  it('cleans up metadata when blob upload fails after db create', async () => {
    const putObject = vi.fn().mockRejectedValue(new Error('blob put failed'))
    const mock = buildDeps({ putObject })
    const adapter = createVercelBlobMediaStorageAdapter(
      { token: 'blob_rw_token' },
      mock.deps as any
    )

    await expect(
      adapter.put({
        filename: 'Hero Image.PNG',
        mimeType: 'image/png',
        size: 6,
        buffer: Buffer.from('binary'),
      })
    ).rejects.toThrow('blob put failed')

    expect(mock.deleteRecord).toHaveBeenCalledWith({ where: { id: 'asset_blob' } })
  })

  it('returns redirect read payload for object-stored media', async () => {
    const mock = buildDeps()
    const adapter = createVercelBlobMediaStorageAdapter(
      { token: 'blob_rw_token' },
      mock.deps as any
    )

    const result = await adapter.get('asset_blob')

    expect(result).toMatchObject({
      redirectUrl: 'https://blob.vercel-storage.com/media/asset_blob/hero-image.png',
      filename: 'Hero Image.PNG',
      mimeType: 'image/png',
    })
  })

  it('deletes object first, then removes db metadata', async () => {
    const mock = buildDeps()
    const adapter = createVercelBlobMediaStorageAdapter(
      { token: 'blob_rw_token' },
      mock.deps as any
    )

    await adapter.delete('asset_blob')

    expect(mock.deleteObject).toHaveBeenCalledWith(
      'https://blob.vercel-storage.com/media/asset_blob/hero-image.png',
      { token: 'blob_rw_token' }
    )
    expect(mock.deleteRecord).toHaveBeenCalledWith({ where: { id: 'asset_blob' } })
  })

  it('does not remove db metadata when blob deletion fails', async () => {
    const deleteObject = vi.fn().mockRejectedValue(new Error('blob delete failed'))
    const mock = buildDeps({ deleteObject })
    const adapter = createVercelBlobMediaStorageAdapter(
      { token: 'blob_rw_token' },
      mock.deps as any
    )

    await expect(adapter.delete('asset_blob')).rejects.toThrow('blob delete failed')
    expect(mock.deleteRecord).not.toHaveBeenCalled()
  })
})
