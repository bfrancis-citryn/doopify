import { describe, expect, it, vi } from 'vitest'

import {
  MAX_MEDIA_UPLOAD_BYTES,
  MAX_MEDIA_UPLOAD_VERCEL_MESSAGE,
  buildProductMediaPayload,
  fetchPersistedProductDetail,
  getOversizedMediaFiles,
  isOversizedMediaFile,
  parseMediaUploadResponse,
  resolveMediaUploadFailureMessage,
  resolveMediaUploadStrategy,
  syncPersistedMediaOnProduct,
} from './product-media-upload.helpers'

describe('product media upload helpers', () => {
  it('attaches drawer uploads directly for saved products', () => {
    expect(
      resolveMediaUploadStrategy({
        editorMode: 'existing',
        draftProductId: 'prod_1',
        attachToDraft: true,
      })
    ).toEqual({
      shouldAttachToDraft: true,
      shouldIncludeProductId: true,
      productId: 'prod_1',
    })
  })

  it('queues uploads in draft state for unsaved products and omits productId during upload', () => {
    expect(
      resolveMediaUploadStrategy({
        editorMode: 'new',
        draftProductId: 'tmp_product',
        attachToDraft: true,
      })
    ).toEqual({
      shouldAttachToDraft: true,
      shouldIncludeProductId: false,
      productId: null,
    })
  })

  it('keeps explicit library uploads detached even for saved products', () => {
    expect(
      resolveMediaUploadStrategy({
        editorMode: 'existing',
        draftProductId: 'prod_1',
        attachToDraft: false,
      })
    ).toEqual({
      shouldAttachToDraft: false,
      shouldIncludeProductId: false,
      productId: null,
    })
  })

  it('builds create payload media entries from queued draft images after product creation', () => {
    const payload = buildProductMediaPayload(
      [
        { id: 'img_1', assetId: 'asset_1', sortOrder: 0 },
        { id: 'img_2', assetId: 'asset_2', sortOrder: 1 },
        { id: 'img_3', assetId: null, sortOrder: 2 },
      ],
      'img_2'
    )

    expect(payload).toEqual([
      { assetId: 'asset_1', position: 0, isFeatured: false },
      { assetId: 'asset_2', position: 1, isFeatured: true },
    ])
  })

  it('rejects files above the Vercel-safe client upload size before fetch', () => {
    const oversized = new File([new Uint8Array(MAX_MEDIA_UPLOAD_BYTES + 1)], 'too-large.png', { type: 'image/png' })
    const valid = new File([new Uint8Array(128)], 'ok.png', { type: 'image/png' })

    expect(isOversizedMediaFile(oversized)).toBe(true)
    expect(isOversizedMediaFile(valid)).toBe(false)
    expect(getOversizedMediaFiles([valid, oversized])).toEqual([oversized])
  })

  it('maps 413 and non-JSON upload responses to the Vercel limit message', async () => {
    expect(
      resolveMediaUploadFailureMessage({
        status: 413,
        jsonError: null,
        isJson: true,
      })
    ).toBe(MAX_MEDIA_UPLOAD_VERCEL_MESSAGE)

    const nonJsonResponse = new Response('payload too large', {
      status: 413,
      headers: { 'content-type': 'text/plain' },
    })
    const parsed = await parseMediaUploadResponse(nonJsonResponse)

    expect(parsed).toEqual({ json: null, isJson: false })
    expect(
      resolveMediaUploadFailureMessage({
        status: nonJsonResponse.status,
        jsonError: null,
        isJson: parsed.isJson,
      })
    ).toBe(MAX_MEDIA_UPLOAD_VERCEL_MESSAGE)
  })

  it('prefers API error payloads and falls back to generic storage message otherwise', () => {
    expect(
      resolveMediaUploadFailureMessage({
        status: 500,
        jsonError: 'Storage write failed. Verify media storage configuration and provider availability.',
        isJson: true,
      })
    ).toBe('Storage write failed. Verify media storage configuration and provider availability.')

    expect(
      resolveMediaUploadFailureMessage({
        status: 500,
        jsonError: null,
        isJson: true,
      })
    ).toBe('Upload failed. Check media storage settings and try again.')
  })

  it('syncs persisted product media so first uploaded image is featured when none was set', () => {
    const updated = syncPersistedMediaOnProduct(
      {
        id: 'prod_1',
        title: 'Dead Coast Society',
        featuredImageId: null,
        images: [],
      },
      [
        {
          id: 'image_1',
          assetId: 'asset_1',
          src: '/api/media/asset_1',
          alt: 'Front shot',
          sortOrder: 0,
        },
      ],
      null
    )

    expect(updated?.images).toHaveLength(1)
    expect(updated?.featuredImageId).toBe('image_1')
  })

  it('syncs persisted media without overwriting non-media product fields', () => {
    const updated = syncPersistedMediaOnProduct(
      {
        id: 'prod_1',
        title: 'Edited title',
        featuredImageId: null,
        images: [],
      },
      [
        {
          id: 'image_1',
          assetId: 'asset_1',
          src: '/api/media/asset_1',
          alt: 'Front shot',
          sortOrder: 0,
        },
      ],
      'image_1'
    )

    expect(updated?.title).toBe('Edited title')
    expect(updated?.featuredImageId).toBe('image_1')
    expect(updated?.images?.[0]?.assetId).toBe('asset_1')
  })

  it('fetches refreshed product detail from /api/products/:id for persisted media sync', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'prod_1', media: [{ id: 'media_1' }] },
      }),
    })

    const result = await fetchPersistedProductDetail({ productId: 'prod_1', fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith('/api/products/prod_1')
    expect(result).toEqual({
      ok: true,
      error: null,
      data: { id: 'prod_1', media: [{ id: 'media_1' }] },
      status: 200,
    })
  })

  it('returns safe failure payload when refreshed product detail fetch fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({
        success: false,
        error: 'Failed to update product',
      }),
    })

    const result = await fetchPersistedProductDetail({ productId: 'prod_1', fetchImpl })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Failed to update product')
    expect(result.status).toBe(500)
  })
})
