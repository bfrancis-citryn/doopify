# Media Object Storage Migration Plan

Documentation date: May 1, 2026

## Goal
Move production media binaries out of Postgres and into object storage without breaking local development, existing product media links, storefront image URLs, or the current admin media library workflow.

## Implementation Status (May 2, 2026)

Shipped in the current implementation slice:

- adapter-based media storage provider selection with `MEDIA_STORAGE_PROVIDER=postgres|s3`
- Postgres storage preserved as default/local fallback
- S3-compatible storage adapter for Cloudflare R2 or AWS S3 using:
  - `MEDIA_S3_ENDPOINT`
  - `MEDIA_S3_REGION`
  - `MEDIA_S3_BUCKET`
  - `MEDIA_S3_ACCESS_KEY_ID`
  - `MEDIA_S3_SECRET_ACCESS_KEY`
  - optional `MEDIA_PUBLIC_BASE_URL`
- Prisma media metadata additions for `storageProvider`, `storageKey`, `storageBucket`, and `publicUrl`, while keeping `MediaAsset.data` compatible for Postgres fallback
- media upload/read/delete routes routed through the adapter boundary with existing API response shapes preserved

Still pending from this plan:

- background migration workflow for existing Postgres-backed media bytes
- staged cleanup/nulling of historical `MediaAsset.data` after migration validation

## Current State Inspected

### Prisma media model

Current media persistence is Postgres-backed:

- `MediaAsset.data` stores the binary bytes directly in Postgres.
- `ProductMedia` links products to `MediaAsset` rows.
- `Collection.imageUrl` is a plain string URL, while collection cover images can also fall back to the first linked product media asset.

Relevant current schema concepts:

```txt
MediaAsset
- id
- filename
- altText
- mimeType
- size
- width
- height
- data Bytes
- productMedia ProductMedia[]

ProductMedia
- productId
- assetId
- position
- isFeatured

Collection
- imageUrl String?
```

### Current media APIs

#### Upload

Current upload endpoint:

```txt
POST /api/media/upload
```

Current behavior:

- Requires `requireAdmin(req)`.
- Accepts multipart form field `file`.
- Optional `productId` links the uploaded media to a product.
- Optional `altText` saves asset alt text.
- Enforces 10 MB max file size.
- Allows only JPEG, PNG, WebP, and GIF.
- Detects MIME type from file bytes instead of trusting browser-reported MIME.
- Rejects files when browser `file.type` does not match detected bytes.
- Verifies `productId` exists before linking.
- Writes bytes to `MediaAsset.data`.
- Optionally creates `ProductMedia` link during the same create.
- Returns `url: /api/media/{assetId}`.

#### List

Current list endpoint:

```txt
GET /api/media?pageSize=...
```

Current behavior:

- Requires admin auth.
- Returns asset metadata and linked product summaries.
- Does not return binary data.
- Builds asset URLs as `/api/media/{assetId}`.

#### Read/serve

Current asset endpoint:

```txt
GET /api/media/{assetId}
```

Current behavior:

- Publicly serves the media bytes by selecting `MediaAsset.data`, `mimeType`, and `filename`.
- Responds with inline content disposition.
- Uses long immutable public cache headers.

#### Metadata update

Current asset endpoint:

```txt
PATCH /api/media/{assetId}
```

Current behavior:

- Requires admin auth.
- Updates `altText`.
- Returns the same media-library asset DTO shape as the list endpoint.

#### Delete

Current asset endpoint:

```txt
DELETE /api/media/{assetId}
```

Current behavior:

- Requires admin auth.
- Deletes the `MediaAsset` row.
- Cascades linked `ProductMedia` records through schema relations.
- Does not need to delete an external object today because bytes live in Postgres.

### Product linking paths

Product media linking happens through the product service:

- Product create/update accepts a `media` array of `{ assetId, position, isFeatured }`.
- `syncProductMedia()` normalizes asset IDs, verifies all assets exist, clears existing links, then writes new `ProductMedia` rows.
- Product duplication reuses existing asset IDs by creating new `ProductMedia` links to the same `MediaAsset` rows.
- Product DTOs attach asset URLs as `/api/media/{assetId}`.
- Storefront product DTOs expose only safe media data: URL, alt text, width, and height.

### Collection linking paths

Collections currently do not link directly to `MediaAsset`.

- `Collection.imageUrl` is a string field.
- Admin collection DTOs expose `imageUrl`.
- Storefront collection summaries/details use `collection.imageUrl` first.
- When `imageUrl` is missing, collection surfaces fall back to the first visible product media asset URL.

This means product media object-storage migration is the first priority. Collection cover-image storage can be a later schema improvement.

## Target Architecture

### Keep database as metadata source of truth

Postgres should still own media metadata and relationships:

- asset identity
- filename
- alt text
- MIME type
- byte size
- dimensions
- storage provider
- storage key
- public URL/cache URL where applicable
- linked products
- collection cover references if added later

Object storage should own only the binary object bytes.

### Proposed schema evolution

Add storage metadata while preserving the current `data` column during migration.

Recommended first schema change:

```prisma
model MediaAsset {
  id              String   @id @default(cuid())
  filename        String
  altText         String?
  mimeType        String   @default("application/octet-stream")
  size            Int?
  width           Int?
  height          Int?

  // Existing fallback/local storage. Keep nullable after migration.
  data            Bytes?

  // New object-storage metadata.
  storageProvider String   @default("postgres") // postgres | r2 | s3
  storageKey      String?
  storageBucket   String?
  storageRegion   String?
  publicUrl       String?
  checksumSha256  String?
  migratedAt      DateTime?

  createdAt       DateTime @default(now())
  productMedia    ProductMedia[]

  @@index([storageProvider])
  @@index([storageKey])
  @@map("media_assets")
}
```

Notes:

- `data` should become nullable only when all runtime reads can handle external storage.
- `storageProvider = "postgres"` means read from `data`.
- `storageProvider = "r2"` or `"s3"` means read from object storage or redirect/proxy to object URL.
- `publicUrl` is optional because private buckets plus signed URLs may be preferred.
- `checksumSha256` helps verify migration integrity.

### Adapter interface

Create a server-only media storage adapter boundary.

Suggested location:

```txt
src/server/media/storage-adapter.ts
```

Suggested types:

```ts
type MediaStorageProvider = 'postgres' | 'r2' | 's3'

type PutMediaObjectInput = {
  assetId: string
  filename: string
  mimeType: string
  buffer: Buffer
  size: number
}

type PutMediaObjectResult = {
  provider: MediaStorageProvider
  key: string | null
  bucket?: string | null
  region?: string | null
  publicUrl?: string | null
  checksumSha256?: string | null
}

type GetMediaObjectResult = {
  body: Buffer | ReadableStream | null
  redirectUrl?: string
  mimeType: string
  size?: number | null
  cacheControl?: string
}

interface MediaStorageAdapter {
  put(input: PutMediaObjectInput): Promise<PutMediaObjectResult>
  get(asset: MediaAssetStorageRecord): Promise<GetMediaObjectResult>
  delete(asset: MediaAssetStorageRecord): Promise<void>
  getPublicUrl?(asset: MediaAssetStorageRecord): string | null
  getSignedUrl?(asset: MediaAssetStorageRecord, options?: { expiresInSeconds?: number }): Promise<string>
}
```

### Runtime adapter selection

Add a resolver:

```txt
src/server/media/media-storage.ts
```

Selection rules:

1. If `MEDIA_STORAGE_PROVIDER=r2`, use R2/S3-compatible adapter.
2. If `MEDIA_STORAGE_PROVIDER=s3`, use S3-compatible adapter.
3. Otherwise default to Postgres adapter for local/dev compatibility.

Suggested env vars:

```txt
MEDIA_STORAGE_PROVIDER=postgres|r2|s3
MEDIA_PUBLIC_BASE_URL=https://cdn.example.com optional
MEDIA_BUCKET=doopify-media
MEDIA_REGION=auto or us-east-1
MEDIA_ENDPOINT=https://accountid.r2.cloudflarestorage.com optional for R2
MEDIA_ACCESS_KEY_ID=...
MEDIA_SECRET_ACCESS_KEY=...
MEDIA_FORCE_PATH_STYLE=false optional
MEDIA_SIGNED_URL_TTL_SECONDS=3600 optional
```

## Provider Implementations

### Postgres fallback adapter

Purpose:

- Keep local development simple.
- Preserve current behavior until production storage is configured.
- Keep existing uploaded assets readable during migration.

Behavior:

- Upload route stores bytes in `MediaAsset.data`.
- Read route returns bytes directly from `MediaAsset.data`.
- Delete route deletes the DB row only.
- `storageProvider` remains `postgres`.

This keeps `npm run dev` usable without R2/S3 credentials.

### R2/S3-compatible adapter

Use an S3-compatible SDK client for both Cloudflare R2 and AWS S3.

Recommended package:

```txt
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
```

Upload behavior:

- Generate deterministic object key after DB asset ID exists:

```txt
media/{assetId}/{safeFilename}
```

- Put object with:
  - `ContentType`
  - `CacheControl: public, max-age=31536000, immutable` for public assets
  - metadata such as original filename and asset ID
- Save storage metadata on `MediaAsset`.

Read behavior options:

Option A — proxy through app route:

- `/api/media/{assetId}` reads DB metadata, gets object from R2/S3, streams it through Next response.
- Pros: stable current URLs, easy private/public boundary, no client changes.
- Cons: app bandwidth cost and slower than direct CDN.

Option B — redirect to public CDN URL:

- `/api/media/{assetId}` returns `302` to `publicUrl` or signed URL.
- Pros: offloads bandwidth and works well with CDN.
- Cons: signed URL expiry and cache behavior need care.

Recommended rollout:

1. Start with proxy route to preserve URL compatibility.
2. Add optional CDN/public URL mode later when cache/origin setup is verified.

Delete behavior:

- Delete object storage object first or mark-delete in DB first depending on desired failure behavior.
- Recommended safe path:
  1. Fetch `MediaAsset` metadata.
  2. Delete object from provider if `storageProvider !== postgres` and `storageKey` exists.
  3. Delete DB row.
  4. If object delete fails, return safe error and do not delete DB row, unless an explicit orphan cleanup job exists.

## Migration Path For Existing Postgres Assets

### Phase 0 — prep

- Add new nullable storage metadata columns.
- Keep `MediaAsset.data` intact.
- Add adapter abstraction.
- Keep `/api/media/{assetId}` URLs stable.
- Add tests that prove Postgres fallback still works.

### Phase 1 — dual-read

Update media read service:

- If `storageProvider === "postgres"`, read from `data`.
- If `storageProvider === "r2" | "s3"`, read from object storage metadata.
- If object read fails but `data` still exists, optionally fall back to Postgres and log the fallback.

### Phase 2 — new uploads to object storage

Update upload route flow:

1. Validate auth, size, MIME, and optional product link exactly as today.
2. Create `MediaAsset` metadata row first with `storageProvider` target and no `data` for external storage.
3. Upload bytes to object storage using the generated asset ID.
4. Update `MediaAsset` with storage key, bucket, checksum, public URL if any, and `migratedAt`.
5. Create product link if provided.
6. If object upload fails after DB row creation, delete/mark failed asset row so broken assets do not appear in the library.

Alternative: use a DB transaction for metadata/linking and a compensating delete for object storage because object storage writes cannot participate in Prisma transactions.

### Phase 3 — background migration job

Add a CLI or job:

```txt
npm run media:migrate-object-storage
```

or

```txt
node scripts/migrate-media-to-object-storage.mjs --dry-run
node scripts/migrate-media-to-object-storage.mjs --limit=100
```

Migration algorithm:

1. Select `MediaAsset` rows where `storageProvider = "postgres"` and `data IS NOT NULL`.
2. For each asset:
   - compute checksum of DB bytes
   - upload to object storage
   - verify object exists and checksum/size matches where provider supports it
   - update row with provider/key/bucket/checksum/migratedAt
   - keep `data` for rollback during the first pass
3. Support `--dry-run`, `--limit`, and resumable pagination.
4. Log migrated count, skipped count, failed count.

### Phase 4 — cutover validation

- Run read checks across migrated assets.
- Verify product pages, collection pages, media library, checkout/email templates if they use media URLs.
- Confirm object storage URLs and cache headers.
- Confirm no raw secrets appear in admin payloads or public DTOs.

### Phase 5 — optional DB cleanup

Only after confidence:

- Add a script to null out `MediaAsset.data` for migrated assets.
- Keep a backup before cleanup.
- Do not drop the `data` column until local/dev fallback and rollback story are finalized.

## Security And Correctness Requirements

### Upload validation

Keep current protections:

- Admin auth required for uploads.
- Max upload size enforced before persistence.
- Byte-sniffed MIME validation.
- SVG rejected.
- Browser-reported MIME must match detected MIME when present.
- Allowed types remain JPEG, PNG, WebP, GIF unless explicitly expanded.

Additional recommended protections:

- Normalize/sanitize filenames before object key use.
- Generate object keys from asset IDs, not user-controlled filenames alone.
- Store original filename as metadata, not as a trust boundary.
- Consider extracting image dimensions server-side after validation.
- Add optional checksum for duplicate detection and migration verification.

### Signed URLs and public URLs

Recommended initial posture:

- Keep `/api/media/{assetId}` as the canonical app URL.
- Use private bucket by default.
- Proxy or redirect server-side so the app controls visibility rules.
- Add signed URL generation only when direct-to-object/CDN delivery is intentionally enabled.

For signed URLs:

- Keep short TTL for private/admin-only assets.
- Public product assets can use long-lived CDN URLs if the bucket/object path is intended public.
- Never expose storage access keys or bucket credentials to the browser.

### Public/private asset boundaries

Current assets are effectively public because `/api/media/{assetId}` serves bytes without auth.

Preserve this for product/storefront assets, but plan for future asset visibility:

```txt
visibility: PUBLIC | PRIVATE
```

Future rules:

- PUBLIC: product photos, storefront collection covers, brand images meant for public pages.
- PRIVATE: admin-only exports, customer documents, internal files if those are added later.

Until visibility exists, treat `MediaAsset` as public-commerce media only. Do not store private documents in this table.

### Delete semantics

Deleting a `MediaAsset` should:

- remove linked `ProductMedia` rows through cascade
- remove or safely orphan-clean the object storage object
- not leave broken product media links
- not expose stale signed URLs after delete where possible

If CDN caching is enabled, expect deleted assets may remain cache-visible until cache expiry or purge.

### Response DTO safety

Media list and storefront DTOs should never expose:

- storage access key
- secret key
- bucket credentials
- private endpoint auth config
- raw provider response
- signed URL generation secrets

Safe public fields:

- id
- url
- filename
- altText
- mimeType
- size
- width/height
- createdAt
- linked product count where admin-only

## Required Code Areas For Future Implementation

### Schema

- `prisma/schema.prisma`
- migration files generated by Prisma once schema is finalized

### Storage layer

- `src/server/media/storage-adapter.ts`
- `src/server/media/postgres-media-storage.ts`
- `src/server/media/s3-media-storage.ts`
- `src/server/media/media-storage.ts`

### API routes

- `src/app/api/media/upload/route.ts`
- `src/app/api/media/[assetId]/route.ts`
- `src/app/api/media/route.ts`

### Service/DTO touch points

- `src/server/services/product.service.ts`
- `src/server/services/collection.service.ts`
- `src/components/media/MediaLibraryWorkspace.js` only if response DTO changes, but the goal should be no UI change in first implementation

### Scripts/jobs

- `scripts/migrate-media-to-object-storage.mjs`
- optional job runner integration if using the background job system

## Testing Plan

### Unit/route tests

- Upload rejects unsupported type.
- Upload rejects SVG even if extension says image.
- Upload rejects browser MIME/content mismatch.
- Upload stores to Postgres adapter when `MEDIA_STORAGE_PROVIDER` is unset.
- Upload stores object metadata when `MEDIA_STORAGE_PROVIDER=r2|s3`.
- Read route serves Postgres-backed asset.
- Read route serves or redirects object-backed asset.
- Delete route deletes object-backed asset and DB row.
- Delete route does not delete DB row when provider delete fails unless an orphan cleanup policy exists.

### Integration tests

Use fake/in-memory S3 adapter or mocked SDK for fast tests.

For real provider verification, add an optional gated integration test with disposable bucket/prefix:

```txt
MEDIA_STORAGE_TEST_BUCKET
MEDIA_STORAGE_TEST_ENDPOINT
MEDIA_STORAGE_TEST_ACCESS_KEY_ID
MEDIA_STORAGE_TEST_SECRET_ACCESS_KEY
```

Never run real object-storage tests against production bucket/prefix.

## Rollout Recommendation

1. Add schema fields and adapter abstraction with Postgres fallback only.
2. Move current `/api/media/{assetId}` reads through the adapter while behavior stays identical.
3. Move upload/delete through the adapter while still using Postgres by default.
4. Add R2/S3 adapter behind env flag.
5. Enable object storage in a staging environment.
6. Add migration script with dry-run and limit controls.
7. Migrate a small batch of existing assets.
8. Verify admin media library, product pages, collection pages, and storefront cache behavior.
9. Migrate remaining assets.
10. After backup and validation, optionally null out migrated `data` bytes.

## Non-Goals For First Implementation

- Direct browser-to-S3 multipart uploads.
- Asset transformations/resizing pipeline.
- Full DAM-style private asset permissions.
- Collection media schema redesign.
- CDN cache purge automation.
- Dropping `MediaAsset.data` immediately.

## Open Questions

- Should production default to R2 because it is cheaper and S3-compatible, or should the adapter remain provider-neutral in docs?
- Should public product assets use direct CDN URLs or keep app-proxied URLs for all assets?
- Should image dimensions be backfilled during migration?
- Should duplicate files be deduplicated by checksum, or should duplicate uploads remain separate assets?
- Should `Collection.imageUrl` eventually become `collectionImageAssetId` linked to `MediaAsset`?
