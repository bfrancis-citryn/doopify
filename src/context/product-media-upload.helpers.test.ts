import { describe, expect, it } from 'vitest'

import { buildProductMediaPayload, resolveMediaUploadStrategy } from './product-media-upload.helpers'

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
})
