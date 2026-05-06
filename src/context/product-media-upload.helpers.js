/**
 * @param {{ editorMode: string, draftProductId: string | null | undefined, attachToDraft: boolean }} input
 */
export function resolveMediaUploadStrategy({ editorMode, draftProductId, attachToDraft }) {
  const shouldAttachToDraft = Boolean(attachToDraft);
  const shouldIncludeProductId = shouldAttachToDraft && editorMode !== 'new' && Boolean(draftProductId);

  return {
    shouldAttachToDraft,
    shouldIncludeProductId,
    productId: shouldIncludeProductId ? draftProductId : null,
  };
}

/**
 * @param {Array<{id: string, assetId?: string | null, sortOrder?: number | null}>} images
 * @param {string | null | undefined} featuredImageId
 */
export function buildProductMediaPayload(images = [], featuredImageId = null) {
  return (images || [])
    .filter(image => image?.assetId)
    .map((image, imageIndex) => ({
      assetId: image.assetId,
      position: image.sortOrder ?? imageIndex,
      isFeatured: image.id === featuredImageId,
    }));
}
