# Media Object Storage Migration Plan

Documentation date: May 1, 2026  
Implementation status updated: May 2, 2026

## Goal
Move production media binaries out of Postgres and into object storage without breaking local development, existing product media links, storefront image URLs, or the current admin media library workflow.

## Implementation Status

Shipped:

- Adapter-based media storage provider selection with `MEDIA_STORAGE_PROVIDER=postgres|s3`.
- Postgres storage preserved as default/local fallback.
- S3-compatible storage adapter for Cloudflare R2 or AWS S3 using:
  - `MEDIA_S3_ENDPOINT`
  - `MEDIA_S3_REGION`
  - `MEDIA_S3_BUCKET`
  - `MEDIA_S3_ACCESS_KEY_ID`
  - `MEDIA_S3_SECRET_ACCESS_KEY`
  - optional `MEDIA_PUBLIC_BASE_URL`
- Prisma media metadata additions for `storageProvider`, `storageKey`, `storageBucket`, and `publicUrl`, while keeping `MediaAsset.data` compatible for Postgres fallback.
- Media upload/read/delete routes routed through the adapter boundary with existing API response shapes preserved.
- Media list now uses the storage public URL helper instead of hardcoding `/api/media/{assetId}`.
- Legacy Postgres-backed media migration command:

```bash
npm run media:migrate-object-storage -- --dry-run
npm run media:migrate-object-storage -- --limit=100
npm run media:migrate-object-storage -- --limit=100 --clear-data
```

Still intentionally pending:

- Production/staging execution of the migration against a disposable prefix first, then the real media bucket.
- Optional image-dimension backfill.
- Optional direct browser-to-object-storage uploads.
- Optional CDN purge workflow.
- Dropping `MediaAsset.data`; it should remain for local/dev fallback and rollback.

## Current Runtime Behavior

### Provider selection

```txt
MEDIA_STORAGE_PROVIDER=postgres # default/local fallback
MEDIA_STORAGE_PROVIDER=s3       # Cloudflare R2 or AWS S3-compatible object storage
```

When `MEDIA_STORAGE_PROVIDER=s3` is configured without the required `MEDIA_S3_*` values, Doopify logs a warning and falls back to Postgres storage so local/dev workflows do not break.

### Required S3-compatible env vars

```txt
MEDIA_S3_REGION=auto
MEDIA_S3_BUCKET=doopify-media
MEDIA_S3_ACCESS_KEY_ID=...
MEDIA_S3_SECRET_ACCESS_KEY=...
MEDIA_S3_ENDPOINT=https://accountid.r2.cloudflarestorage.com optional
MEDIA_PUBLIC_BASE_URL=https://cdn.example.com/media optional
```

### URL behavior

`/api/media/{assetId}` remains the canonical app URL.

- Postgres assets are served by the app from `MediaAsset.data`.
- S3 assets with `publicUrl` redirect to the public/CDN URL.
- S3 assets without `publicUrl` are streamed through the app route.

This preserves existing storefront/product/admin URL compatibility.

## Current Media APIs

### Upload

```txt
POST /api/media/upload
```

Current behavior:

- Requires admin auth.
- Accepts multipart form field `file`.
- Optional `productId` links the uploaded media to a product.
- Optional `altText` saves asset alt text.
- Enforces 10 MB max file size.
- Allows only JPEG, PNG, WebP, and GIF.
- Detects MIME type from file bytes instead of trusting browser-reported MIME.
- Rejects files when browser `file.type` does not match detected bytes.
- Verifies `productId` exists before linking.
- Writes through the selected media storage adapter.
- Returns the existing media asset DTO shape with `url`.

### List

```txt
GET /api/media?pageSize=...
```

Current behavior:

- Requires admin auth.
- Returns asset metadata and linked product summaries.
- Does not return binary data.
- Builds asset URLs through `getMediaPublicUrl(asset.id)`.

### Read/serve

```txt
GET /api/media/{assetId}
```

Current behavior:

- Publicly serves product/storefront media.
- Uses long immutable public cache headers.
- Returns Postgres-backed bytes, redirects to object public URL, or streams object bytes depending on adapter result.

### Metadata update

```txt
PATCH /api/media/{assetId}
```

Current behavior:

- Requires admin auth.
- Updates `altText`.
- Returns the same media-library asset DTO shape as the list endpoint.

### Delete

```txt
DELETE /api/media/{assetId}
```

Current behavior:

- Requires admin auth.
- Deletes via the active storage adapter.
- For S3-backed assets, object delete happens before DB row delete.
- If object delete fails, the DB row is not deleted so the asset does not become an untracked orphan.

## Database Metadata Source Of Truth

Postgres owns media metadata and relationships:

- asset identity
- filename
- alt text
- MIME type
- byte size
- dimensions
- storage provider
- storage key
- storage bucket
- public URL/cache URL where applicable
- linked products

Object storage owns binary object bytes when `storageProvider = "s3"`.

Current schema concept:

```prisma
model MediaAsset {
  id              String   @id @default(cuid())
  filename        String
  altText         String?
  mimeType        String   @default("application/octet-stream")
  size            Int?
  width           Int?
  height          Int?
  data            Bytes?
  storageProvider String   @default("postgres")
  storageKey      String?
  storageBucket   String?
  publicUrl       String?
  createdAt       DateTime @default(now())
  productMedia    ProductMedia[]

  @@index([storageProvider])
  @@index([storageKey])
  @@map("media_assets")
}
```

## Migration Command

Command:

```bash
npm run media:migrate-object-storage -- --dry-run
npm run media:migrate-object-storage -- --limit=100
npm run media:migrate-object-storage -- --limit=100 --clear-data
```

Algorithm:

1. Select `MediaAsset` rows where `storageProvider = "postgres"` and `data IS NOT NULL`.
2. Build deterministic key: `media/{assetId}/{safeFilename}`.
3. Compute SHA-256 checksum for logging/object metadata.
4. Upload bytes to S3/R2 with content type, cache control, asset id, filename, and checksum metadata.
5. Update the row with:
   - `storageProvider = "s3"`
   - `storageKey`
   - `storageBucket`
   - `publicUrl` when `MEDIA_PUBLIC_BASE_URL` is configured
6. Keep `data` by default for rollback.
7. Only when `--clear-data` is explicitly passed, null `MediaAsset.data` after successful object upload and metadata update.
8. Continue batch execution after per-asset failures and exit non-zero if any failures occurred.

Safety notes:

- `--dry-run` never uploads or mutates rows.
- `MEDIA_STORAGE_PROVIDER=s3` is required for write migrations.
- Use a staging bucket/prefix first.
- Keep a DB backup before `--clear-data`.
- Do not drop `MediaAsset.data` while Postgres fallback remains supported.

## Product Linking Paths

Product media linking remains unchanged:

- Product create/update accepts media references by `assetId`.
- Product duplication reuses existing `MediaAsset` rows.
- Storefront product DTOs continue to expose safe media URLs.

## Collection Linking Paths

Collections currently do not link directly to `MediaAsset`.

- `Collection.imageUrl` is a string field.
- Collection cover images can fall back to linked product media.
- Direct collection asset linking can be a later schema improvement.

## Security And Correctness Requirements

### Upload validation

Current protections remain required:

- Admin auth for uploads.
- Max upload size enforced before persistence.
- Byte-sniffed MIME validation.
- SVG rejected.
- Browser-reported MIME must match detected MIME when present.
- Allowed types: JPEG, PNG, WebP, GIF.

### Object key safety

- Filenames are sanitized before object-key use.
- Object keys are asset-id scoped, not user-filename-only.
- Original filename is stored only as metadata/display context.
- Storage access keys and bucket credentials are never exposed to browser DTOs.

### Public/private boundary

Current `MediaAsset` is public-commerce media only because `/api/media/{assetId}` is public.

Do not store private customer/internal documents in this table until asset visibility exists, for example:

```txt
visibility: PUBLIC | PRIVATE
```

### Delete semantics

Deleting a `MediaAsset` should:

- remove linked `ProductMedia` rows through cascade
- remove object storage object for S3-backed assets
- avoid deleting DB metadata when object delete fails
- expect CDN-cached assets to remain visible until cache expiry or purge

## Test Coverage

Current tests cover:

- Postgres fallback resolver behavior.
- S3 object key generation.
- S3 upload and metadata persistence.
- S3 upload failure metadata cleanup.
- S3 delete failure does not delete DB metadata.
- S3 public URL redirect reads.
- Upload route calls adapter for valid uploads.
- Upload route returns safe failure when adapter upload fails.
- Delete route calls adapter delete.
- Delete route returns safe failure when adapter delete fails.

Recommended optional future coverage:

- Gated real-bucket integration test against a disposable bucket/prefix.
- Migration script dry-run test with mocked Prisma/object client.

## Rollout Recommendation

1. Run full local gate.
2. Configure a staging/disposable bucket and `MEDIA_PUBLIC_BASE_URL` if using CDN/public delivery.
3. Run:

```bash
npm run media:migrate-object-storage -- --dry-run
```

4. Migrate a tiny batch without clearing DB bytes:

```bash
npm run media:migrate-object-storage -- --limit=5
```

5. Verify `/media`, product admin, storefront product pages, collection fallbacks, and direct `/api/media/{id}` URLs.
6. Migrate remaining assets in batches.
7. After backup and validation, optionally run with `--clear-data` for migrated assets.
8. Keep Postgres fallback in code until rollback confidence is high.

## Non-Goals

- Direct browser-to-S3 multipart uploads.
- Asset transformations/resizing pipeline.
- Full DAM-style private asset permissions.
- Collection media schema redesign.
- CDN cache purge automation.
- Dropping `MediaAsset.data` immediately.

## Open Questions

- Should public product assets use direct CDN URLs in storefront DTOs or keep app-proxied URLs permanently?
- Should image dimensions be backfilled during migration?
- Should duplicate files be deduplicated by checksum, or should duplicate uploads remain separate assets?
- Should `Collection.imageUrl` eventually become `collectionImageAssetId` linked to `MediaAsset`?
