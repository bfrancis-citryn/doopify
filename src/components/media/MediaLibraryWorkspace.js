"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../AppShell';
import layoutStyles from '../layout/AppShell.module.css';
import styles from './MediaLibraryWorkspace.module.css';

function mergeAssets(currentAssets, incomingAssets) {
  const assetMap = new Map(currentAssets.map(asset => [asset.id, asset]));
  incomingAssets.forEach(asset => {
    if (!asset?.id) {
      return;
    }

    assetMap.set(asset.id, {
      ...assetMap.get(asset.id),
      ...asset,
    });
  });

  return [...assetMap.values()].sort((first, second) => {
    const firstDate = first?.createdAt ? new Date(first.createdAt).getTime() : 0;
    const secondDate = second?.createdAt ? new Date(second.createdAt).getTime() : 0;
    return secondDate - firstDate;
  });
}

function formatAssetDate(value) {
  if (!value) {
    return 'Recently added';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return 'Recently added';
  }
}

function formatFileSize(value) {
  const size = Number(value || 0);
  if (!size) {
    return 'Unknown size';
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
}

export default function MediaLibraryWorkspace() {
  const uploadInputRef = useRef(null);
  const [assets, setAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState(null);
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
        if (searchQuery.trim()) {
          params.set('search', searchQuery.trim());
        }

        const res = await fetch(`/api/media?${params.toString()}`);
        const json = await res.json();

        if (!isActive) {
          return;
        }

        if (!json.success) {
          setErrorMessage(json.error || 'Could not load the media library.');
          return;
        }

        const nextAssets = json.data.assets || [];
        setAssets(nextAssets);
        setSelectedAssetId(currentSelectedId => {
          if (nextAssets.some(asset => asset.id === currentSelectedId)) {
            return currentSelectedId;
          }

          return nextAssets[0]?.id || null;
        });
      } catch (error) {
        console.error('[MediaLibraryWorkspace] media fetch failed', error);
        if (isActive) {
          setErrorMessage('Could not load the media library.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }, 180);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const selectedAsset = useMemo(
    () => assets.find(asset => asset.id === selectedAssetId) || null,
    [assets, selectedAssetId]
  );

  useEffect(() => {
    if (!assets.length || selectedAsset) {
      return;
    }

    setSelectedAssetId(assets[0].id);
  }, [assets, selectedAsset]);

  useEffect(() => {
    setAltDraft(selectedAsset?.altText || '');
  }, [selectedAsset?.altText, selectedAsset?.id]);

  const activeProducts = selectedAsset?.products || [];

  const handleUploadFiles = async fileList => {
    const files = Array.from(fileList || []);
    if (!files.length) {
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    setNotice('');

    try {
      const uploadedAssets = [];

      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        form.append('altText', file.name);

        const res = await fetch('/api/media/upload', {
          method: 'POST',
          body: form,
        });
        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error || 'Upload failed');
        }

        uploadedAssets.push(json.data);
      }

      const normalizedUploads = uploadedAssets.map(asset => ({
        ...asset,
        products: [],
      }));

      setAssets(currentAssets => mergeAssets(currentAssets, normalizedUploads));
      setSelectedAssetId(normalizedUploads[0]?.id || selectedAssetId);
      setNotice(`${normalizedUploads.length} asset${normalizedUploads.length > 1 ? 's' : ''} uploaded to the library.`);
    } catch (error) {
      console.error('[MediaLibraryWorkspace] upload failed', error);
      setErrorMessage(error.message || 'Could not upload media.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!selectedAsset) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setNotice('');

    try {
      const res = await fetch(`/api/media/${selectedAsset.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          altText: altDraft,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Could not save metadata.');
      }

      setAssets(currentAssets =>
        currentAssets.map(asset => (asset.id === json.data.id ? json.data : asset))
      );
      setNotice('Alt text saved.');
    } catch (error) {
      console.error('[MediaLibraryWorkspace] metadata save failed', error);
      setErrorMessage(error.message || 'Could not save metadata.');
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
      const res = await fetch(`/api/media/${selectedAsset.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || 'Could not delete asset.');
      }

      setAssets(currentAssets => currentAssets.filter(asset => asset.id !== selectedAsset.id));
      setSelectedAssetId(currentSelectedId => (currentSelectedId === selectedAsset.id ? null : currentSelectedId));
      setNotice('Asset deleted.');
    } catch (error) {
      console.error('[MediaLibraryWorkspace] delete failed', error);
      setErrorMessage(error.message || 'Could not delete asset.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppShell
      onCreateOrder={() => uploadInputRef.current?.click()}
      onNotificationsClick={() => setNotice('Media sync is healthy.')}
      onQuickActionClick={() => setSearchQuery('')}
      onSearchChange={event => setSearchQuery(event.target.value)}
      primaryActionLabel={isUploading ? 'Uploading...' : 'Upload media'}
      searchPlaceholder="Search filenames, alt text, or linked products..."
      searchValue={searchQuery}
    >
      <input
        accept="image/*"
        hidden
        multiple
        onChange={event => {
          handleUploadFiles(event.target.files);
          event.target.value = '';
        }}
        ref={uploadInputRef}
        type="file"
      />

      <div className={layoutStyles.splitView}>
        <section className={styles.libraryPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Media Library</p>
              <h2 className={`font-headline ${styles.title}`}>All uploaded assets</h2>
            </div>
            <div className={styles.statPill}>
              <span className="material-symbols-outlined">photo_library</span>
              <span>{assets.length} shown</span>
            </div>
          </div>

          {notice ? <p className={styles.notice}>{notice}</p> : null}
          {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

          {isLoading ? (
            <div className={styles.emptyState}>Loading media library...</div>
          ) : assets.length ? (
            <div className={styles.assetGrid}>
              {assets.map(asset => {
                const isSelected = asset.id === selectedAssetId;
                return (
                  <button
                    key={asset.id}
                    className={isSelected ? styles.assetCardActive : styles.assetCard}
                    onClick={() => setSelectedAssetId(asset.id)}
                    type="button"
                  >
                    <div className={styles.assetImageWrap}>
                      <Image
                        alt={asset.altText || asset.filename || 'Media asset'}
                        className={styles.assetImage}
                        fill
                        src={asset.url}
                        unoptimized
                      />
                    </div>
                    <div className={styles.assetMeta}>
                      <p className={styles.assetName}>{asset.filename}</p>
                      <p className={styles.assetAlt}>{asset.altText || 'No alt text yet'}</p>
                    </div>
                    <div className={styles.assetFooter}>
                      <span>{formatAssetDate(asset.createdAt)}</span>
                      <span>{asset.linkedProducts ? `${asset.linkedProducts} linked` : 'Unlinked'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined">imagesmode</span>
              <p className={`font-headline ${styles.emptyTitle}`}>No media yet</p>
              <p className={styles.emptyText}>Upload product photos here to reuse them across the admin.</p>
            </div>
          )}
        </section>

        <div className={`${layoutStyles.detailDock} ${layoutStyles.detailDockOpen}`}>
          <div className={`${layoutStyles.detailPanel} ${layoutStyles.detailPanelOpen}`}>
            <section className={styles.detailShell}>
              {selectedAsset ? (
                <>
                  <div className={styles.detailPreview}>
                    <Image
                      alt={selectedAsset.altText || selectedAsset.filename || 'Selected media asset'}
                      className={styles.detailPreviewImage}
                      fill
                      src={selectedAsset.url}
                      unoptimized
                    />
                  </div>

                  <div className={styles.detailHeader}>
                    <div>
                      <p className={styles.eyebrow}>Asset Details</p>
                      <h3 className={`font-headline ${styles.detailTitle}`}>{selectedAsset.filename}</h3>
                    </div>
                    <button
                      className={styles.deleteButton}
                      disabled={isDeleting}
                      onClick={handleDeleteAsset}
                      type="button"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>

                  <div className={styles.detailStats}>
                    <div className={styles.detailStat}>
                      <span>Type</span>
                      <strong>{selectedAsset.mimeType}</strong>
                    </div>
                    <div className={styles.detailStat}>
                      <span>Size</span>
                      <strong>{formatFileSize(selectedAsset.size)}</strong>
                    </div>
                    <div className={styles.detailStat}>
                      <span>Linked</span>
                      <strong>{selectedAsset.linkedProducts}</strong>
                    </div>
                  </div>

                  <label className={styles.field}>
                    <span>Alt text</span>
                    <textarea
                      onChange={event => setAltDraft(event.target.value)}
                      placeholder="Describe the image for SEO and screen readers..."
                      rows={5}
                      value={altDraft}
                    />
                  </label>

                  <div className={styles.helperCard}>
                    <p className={styles.helperTitle}>SEO guidance</p>
                    <p className={styles.helperText}>Keep alt text specific and literal. Mention the product or subject, avoid keyword stuffing, and skip phrases like “image of”.</p>
                  </div>

                  <div className={styles.actionRow}>
                    <button
                      className={styles.primaryButton}
                      disabled={isSaving}
                      onClick={handleSaveMetadata}
                      type="button"
                    >
                      {isSaving ? 'Saving...' : 'Save alt text'}
                    </button>
                    <button className={styles.secondaryButton} onClick={() => setAltDraft(selectedAsset.altText || '')} type="button">
                      Reset
                    </button>
                  </div>

                  <div className={styles.linkedSection}>
                    <div className={styles.linkedHeader}>
                      <p className={styles.linkedTitle}>Linked products</p>
                      <span>{selectedAsset.linkedProducts}</span>
                    </div>
                    {activeProducts.length ? (
                      <div className={styles.linkedList}>
                        {activeProducts.map(product => (
                          <Link className={styles.linkedProduct} href={`/products?product=${product.id}`} key={product.id}>
                            <span>{product.title}</span>
                            <span className="material-symbols-outlined">arrow_forward</span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.linkedEmpty}>This asset is not attached to any product yet.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.detailEmpty}>
                  <span className="material-symbols-outlined">photo</span>
                  <p className={`font-headline ${styles.emptyTitle}`}>Select an asset</p>
                  <p className={styles.emptyText}>Choose a photo from the library to update alt text or remove it.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
