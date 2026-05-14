"use client";

import Image from 'next/image';
import Link from 'next/link';
import {
  ChangeEvent,
  ComponentType,
  InputHTMLAttributes,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AppShellBase from '../AppShell';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminEmptyStateBase from '../admin/ui/AdminEmptyState';
import AdminFormSection from '../admin/ui/AdminFormSection';
import AdminInputBase from '../admin/ui/AdminInput';
import AdminPage from '../admin/ui/AdminPage';
import AdminPageHeaderBase from '../admin/ui/AdminPageHeader';
import AdminSelectableTileBase from '../admin/ui/AdminSelectableTile';
import AdminSkeleton from '../admin/ui/AdminSkeleton';
import AdminSplitPane from '../admin/ui/AdminSplitPane';
import AdminToolbarBase from '../admin/ui/AdminToolbar';
import AdminUploadDropzone from '../admin/ui/AdminUploadDropzone';
import {
  MAX_MEDIA_UPLOAD_VERCEL_FORMAT_HINT,
  getOversizedMediaFiles,
  parseMediaUploadResponse,
  resolveMediaUploadFailureMessage,
} from '../../context/product-media-upload.helpers';
import styles from './MediaLibraryWorkspace.module.css';

type LinkedProduct = {
  id: string;
  title: string;
  handle?: string | null;
};

type MediaAsset = {
  id: string;
  url: string;
  filename: string;
  altText?: string | null;
  mimeType?: string | null;
  size?: number | null;
  createdAt?: string | Date | null;
  linkedProducts?: number | null;
  products?: LinkedProduct[];
};

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error?: string;
};

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

type MediaListResponse = {
  assets?: MediaAsset[];
};

type AppShellProps = {
  children: ReactNode;
};

type AdminPageHeaderProps = {
  actions?: ReactNode;
  description?: string;
  eyebrow?: string;
  title?: string;
};

type AdminToolbarProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

type AdminSelectableTileProps = {
  action?: ReactNode;
  className?: string;
  disabled?: boolean;
  footer?: ReactNode;
  media?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  subtitle?: ReactNode;
  title?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
};

type AdminEmptyStateProps = {
  action?: ReactNode;
  actionLabel?: string;
  description?: string;
  icon?: string;
  onAction?: () => void;
  title?: string;
};

const AppShell = AppShellBase as ComponentType<AppShellProps>;
const AdminPageHeader = AdminPageHeaderBase as ComponentType<AdminPageHeaderProps>;
const AdminToolbar = AdminToolbarBase as ComponentType<AdminToolbarProps>;
const AdminSelectableTile = AdminSelectableTileBase as ComponentType<AdminSelectableTileProps>;
const AdminEmptyState = AdminEmptyStateBase as ComponentType<AdminEmptyStateProps>;
const AdminInput = AdminInputBase as ComponentType<InputHTMLAttributes<HTMLInputElement>>;

function mergeAssets(currentAssets: MediaAsset[], incomingAssets: MediaAsset[]) {
  const assetMap = new Map(currentAssets.map((asset) => [asset.id, asset]));
  incomingAssets.forEach((asset) => {
    if (asset?.id) {
      assetMap.set(asset.id, { ...assetMap.get(asset.id), ...asset });
    }
  });
  return [...assetMap.values()].sort(
    (first, second) =>
      (second?.createdAt ? new Date(second.createdAt).getTime() : 0) -
      (first?.createdAt ? new Date(first.createdAt).getTime() : 0)
  );
}

function formatAssetDate(value?: string | Date | null) {
  if (!value) return 'Recently added';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  } catch {
    return 'Recently added';
  }
}

function formatFileSize(value?: number | null) {
  const size = Number(value || 0);
  if (!size) return 'Unknown size';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function MediaLibraryWorkspace() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams({ pageSize: '100' });
        if (searchQuery.trim()) params.set('search', searchQuery.trim());

        const res = await fetch(`/api/media?${params.toString()}`);
        const json = (await res.json()) as ApiResponse<MediaListResponse>;

        if (!isActive) return;

        if (!json.success) {
          setErrorMessage(json.error || 'Could not load the media library.');
          return;
        }

        const nextAssets = json.data.assets || [];
        setAssets(nextAssets);
        setSelectedAssetId((currentSelectedId) =>
          nextAssets.some((asset) => asset.id === currentSelectedId) ? currentSelectedId : nextAssets[0]?.id || null
        );
      } catch (error) {
        console.error('[MediaLibraryWorkspace] media fetch failed', error);
        if (isActive) setErrorMessage('Could not load the media library.');
      } finally {
        if (isActive) setIsLoading(false);
      }
    }, 180);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) || null,
    [assets, selectedAssetId]
  );

  useEffect(() => {
    if (!assets.length || selectedAsset) return;
// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional effect-driven state sync for existing async/load flow
    setSelectedAssetId(assets[0].id);
  }, [assets, selectedAsset]);

  useEffect(() => {
// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional effect-driven state sync for existing async/load flow
    setAltDraft(selectedAsset?.altText || '');
  }, [selectedAsset?.altText, selectedAsset?.id]);

  const activeProducts = selectedAsset?.products || [];
  const hasAssets = assets.length > 0;

  const handleUploadFiles = async (fileList: FileList | File[] | null) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const oversizedFiles = getOversizedMediaFiles(files);
    if (oversizedFiles.length) {
      setErrorMessage(MAX_MEDIA_UPLOAD_VERCEL_FORMAT_HINT);
      setNotice('');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    setNotice('');

    try {
      const uploadedAssets: MediaAsset[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        form.append('altText', file.name);

        const res = await fetch('/api/media/upload', { method: 'POST', body: form });
        const { json, isJson } = await parseMediaUploadResponse(res);
        if (!res.ok || !json?.success) {
          throw new Error(
            resolveMediaUploadFailureMessage({
              status: res.status,
              jsonError: json && 'error' in json ? json.error || null : null,
              isJson,
            })
          );
        }
        uploadedAssets.push(json.data);
      }

      const normalizedUploads = uploadedAssets.map((asset) => ({ ...asset, products: [] }));
      setAssets((currentAssets) => mergeAssets(currentAssets, normalizedUploads));
      setSelectedAssetId(normalizedUploads[0]?.id || selectedAssetId);
      setNotice(`${normalizedUploads.length} asset${normalizedUploads.length > 1 ? 's' : ''} uploaded to the library.`);
    } catch (error) {
      console.error('[MediaLibraryWorkspace] upload failed', error);
      setErrorMessage(getErrorMessage(error, 'Could not upload media.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!selectedAsset) return;

    setIsSaving(true);
    setErrorMessage('');
    setNotice('');

    try {
      const res = await fetch(`/api/media/${selectedAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ altText: altDraft }),
      });
      const json = (await res.json()) as ApiResponse<MediaAsset>;
      if (!json.success) throw new Error(json.error || 'Could not save metadata.');

      setAssets((currentAssets) => currentAssets.map((asset) => (asset.id === json.data.id ? json.data : asset)));
      setNotice('Alt text saved.');
    } catch (error) {
      console.error('[MediaLibraryWorkspace] metadata save failed', error);
      setErrorMessage(getErrorMessage(error, 'Could not save metadata.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset || !window.confirm(`Delete ${selectedAsset.filename}? This will remove it from linked product galleries.`)) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage('');
    setNotice('');

    try {
      const res = await fetch(`/api/media/${selectedAsset.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as ApiFailure | null;
        throw new Error(json?.error || 'Could not delete asset.');
      }

      setAssets((currentAssets) => currentAssets.filter((asset) => asset.id !== selectedAsset.id));
      setSelectedAssetId((currentSelectedId) => (currentSelectedId === selectedAsset.id ? null : currentSelectedId));
      setNotice('Asset deleted.');
    } catch (error) {
      console.error('[MediaLibraryWorkspace] delete failed', error);
      setErrorMessage(getErrorMessage(error, 'Could not delete asset.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppShell>
      <input
        accept="image/*"
        hidden
        multiple
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          handleUploadFiles(event.target.files);
          event.target.value = '';
        }}
        ref={uploadInputRef}
        type="file"
      />

      <AdminPage>
        <AdminPageHeader
          actions={<AdminButton onClick={() => uploadInputRef.current?.click()} size="sm" variant="primary">{isUploading ? 'Uploading...' : 'Upload media'}</AdminButton>}
          description="Manage reusable product images stored in your configured media provider."
          eyebrow="Media"
          title="Media library"
        />

        <AdminSplitPane className={styles.mediaPane}>
          <AdminCard className={styles.libraryPanel} variant="panel">
            {hasAssets || isLoading ? (
              <>
                <AdminUploadDropzone
                  description="Drag JPG, PNG, WebP, or GIF files up to 4.5 MB into the library, or choose files manually."
                  disabled={isUploading}
                  onFilesSelected={handleUploadFiles}
                  title={isUploading ? 'Uploading assets...' : 'Upload new assets'}
                />

                <AdminToolbar>
                  <AdminInput onChange={(event) => setSearchQuery(String(event.currentTarget.value))} placeholder="Search filename or alt text..." type="search" value={searchQuery} />
                  <span className={styles.meta}>{assets.length} shown</span>
                </AdminToolbar>
              </>
            ) : null}

            {notice ? <p className={styles.notice}>{notice}</p> : null}
            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

            {isLoading ? (
              <AdminSkeleton rows={8} variant="table" />
            ) : hasAssets ? (
              <div className={styles.assetGrid}>
                {assets.map((asset) => {
                  const isSelected = asset.id === selectedAssetId;
                  return (
                    <AdminSelectableTile
                      className={styles.assetTile}
                      footer={(
                        <>
                          <span>{formatAssetDate(asset.createdAt)}</span>
                          <span>{asset.linkedProducts ? `${asset.linkedProducts} linked` : 'Unlinked'}</span>
                        </>
                      )}
                      key={asset.id}
                      media={(
                        <div className={styles.assetImageWrap}>
                          <Image alt={asset.altText || asset.filename || 'Media asset'} className={styles.assetImage} fill src={asset.url} unoptimized />
                        </div>
                      )}
                      onClick={() => setSelectedAssetId(asset.id)}
                      selected={isSelected}
                      subtitle={asset.altText || 'No alt text yet'}
                      title={asset.filename}
                      type="button"
                    />
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyUploadState}>
                <div className={styles.emptyUploadCopy}>
                  <p className={styles.emptyUploadTitle}>No media yet</p>
                  <p className={styles.emptyUploadText}>Upload product photos here to reuse them across the admin.</p>
                </div>
                <AdminUploadDropzone
                  className={styles.emptyUploadDropzone}
                  description="Drop JPG, PNG, WebP, or GIF files up to 4.5 MB to start your media library."
                  disabled={isUploading}
                  onFilesSelected={handleUploadFiles}
                  title={isUploading ? 'Uploading assets...' : 'Upload your first asset'}
                />
              </div>
            )}
          </AdminCard>

          <AdminCard className={styles.detailPanel} variant="panel">
            {selectedAsset ? (
              <>
                <div className={styles.detailPreview}>
                  <Image alt={selectedAsset.altText || selectedAsset.filename || 'Selected media asset'} className={styles.detailPreviewImage} fill src={selectedAsset.url} unoptimized />
                </div>

                <AdminFormSection eyebrow="Asset details" title={selectedAsset.filename}>
                  <div className={styles.detailStats}>
                    <div><strong>Type:</strong> {selectedAsset.mimeType}</div>
                    <div><strong>Size:</strong> {formatFileSize(selectedAsset.size)}</div>
                    <div><strong>Linked:</strong> {selectedAsset.linkedProducts}</div>
                  </div>
                  <AdminInput
                    onChange={(event) => setAltDraft(String(event.currentTarget.value))}
                    placeholder="Describe the image for SEO and accessibility..."
                    value={altDraft}
                  />
                  <div className={styles.actionRow}>
                    <AdminButton disabled={isSaving} onClick={handleSaveMetadata} size="sm" variant="primary">{isSaving ? 'Saving...' : 'Save alt text'}</AdminButton>
                    <AdminButton onClick={() => setAltDraft(selectedAsset.altText || '')} size="sm" variant="secondary">Reset</AdminButton>
                    <AdminButton disabled={isDeleting} onClick={handleDeleteAsset} size="sm" variant="danger">Delete</AdminButton>
                  </div>
                </AdminFormSection>

                <AdminFormSection eyebrow="Linked" title="Linked products">
                  {activeProducts.length ? (
                    <div className={styles.linkedList}>
                      {activeProducts.map((product) => (
                        <Link className={styles.linkedProduct} href={`/products?product=${product.id}`} key={product.id}>{product.title}</Link>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.meta}>This asset is not attached to any product yet.</p>
                  )}
                </AdminFormSection>
              </>
            ) : (
              <AdminEmptyState
                description="Choose a media item to update alt text or remove it."
                icon="photo"
                title="Select an asset"
              />
            )}
          </AdminCard>
        </AdminSplitPane>
      </AdminPage>
    </AppShell>
  );
}
