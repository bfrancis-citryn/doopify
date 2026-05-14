// Keep client-side limit at Vercel's function payload ceiling. Server may allow larger files on non-Vercel hosts.
export const MAX_MEDIA_UPLOAD_BYTES = Math.floor(4.5 * 1024 * 1024)
export const MAX_MEDIA_UPLOAD_VERCEL_MESSAGE =
  'Image is too large. Max upload size is 4.5 MB on Vercel.'
export const MAX_MEDIA_UPLOAD_VERCEL_FORMAT_HINT =
  'Image is too large. Max upload size is 4.5 MB on Vercel. Use a compressed JPG, PNG, WebP, or GIF.'
export const GENERIC_MEDIA_UPLOAD_FAILURE_MESSAGE =
  'Upload failed. Check media storage settings and try again.'

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

/**
 * @param {File | null | undefined} file
 */
export function isOversizedMediaFile(file) {
  return Number(file?.size || 0) > MAX_MEDIA_UPLOAD_BYTES
}

/**
 * @param {ArrayLike<File> | File[] | null | undefined} fileList
 */
export function getOversizedMediaFiles(fileList) {
  return Array.from(fileList || []).filter(isOversizedMediaFile)
}

/**
 * @param {Response} response
 */
export async function parseMediaUploadResponse(response) {
  const contentType = response.headers?.get?.('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return { json: null, isJson: false }
  }

  try {
    return { json: await response.json(), isJson: true }
  } catch {
    return { json: null, isJson: false }
  }
}

/**
 * @param {{ status: number, jsonError?: string | null, isJson?: boolean }} input
 */
export function resolveMediaUploadFailureMessage({ status, jsonError, isJson = true }) {
  if (jsonError) {
    return jsonError
  }

  if (status === 413 || !isJson) {
    return MAX_MEDIA_UPLOAD_VERCEL_MESSAGE
  }

  return GENERIC_MEDIA_UPLOAD_FAILURE_MESSAGE
}

/**
 * @param {Record<string, any> | null | undefined} product
 * @param {Array<Record<string, any>>} images
 * @param {string | null | undefined} featuredImageId
 */
export function syncPersistedMediaOnProduct(product, images, featuredImageId) {
  if (!product || !Array.isArray(images)) {
    return product || null
  }

  return {
    ...product,
    images: images.map(image => ({
      ...image,
    })),
    featuredImageId: featuredImageId || images[0]?.id || null,
  }
}

/**
 * @param {{ productId: string, fetchImpl?: typeof fetch }} input
 */
export async function fetchPersistedProductDetail({ productId, fetchImpl = fetch }) {
  if (!productId) {
    return { ok: false, error: 'Missing product id', data: null, status: 0 }
  }

  try {
    const response = await fetchImpl(`/api/products/${productId}`)
    const json = await response.json().catch(() => null)
    if (!response.ok || !json?.success || !json?.data) {
      return {
        ok: false,
        error: json?.error || 'Failed to fetch refreshed product detail.',
        data: null,
        status: response.status,
      }
    }

    return { ok: true, error: null, data: json.data, status: response.status }
  } catch {
    return {
      ok: false,
      error: 'Failed to fetch refreshed product detail.',
      data: null,
      status: 0,
    }
  }
}
