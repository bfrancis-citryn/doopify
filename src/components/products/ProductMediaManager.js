"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminButton from '../admin/ui/AdminButton';
import AdminUploadDropzone from '../admin/ui/AdminUploadDropzone';
import { useProductStore } from '../../context/ProductContext';
import styles from './ProductMediaManager.module.css';

function mergeLibraryAssets(currentAssets, incomingAssets) {
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
    }).format(new Date(value));
  } catch {
    return 'Recently added';
  }
}

export default function ProductMediaManager() {
  const { editor, actions } = useProductStore();
  const uploadInputRef = useRef(null);
  const draggedImageIdRef = useRef(null);
  const [activeTab, setActiveTab] = useState('gallery');
  const [libraryAssets, setLibraryAssets] = useState([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const draftProduct = editor.draftProduct;

  const previewImage =
    draftProduct?.images.find(image => image.id === editor.previewImageId) ||
    editor.draftFeaturedImage ||
    null;

  const assetIdsInGallery = useMemo(
    () => new Set((draftProduct?.images || []).map(image => image.assetId).filter(Boolean)),
    [draftProduct?.images]
  );

  useEffect(() => {
    let isActive = true;

    async function loadLibrary() {
      setIsLibraryLoading(true);
      setLibraryError('');

      try {
        const res = await fetch('/api/media?pageSize=72');
        const json = await res.json();

        if (!isActive) {
          return;
        }

        if (!json.success) {
          setLibraryError(json.error || 'Could not load the media library.');
          return;
        }

        setLibraryAssets(json.data.assets || []);
      } catch (error) {
        console.error('[ProductMediaManager] media library fetch failed', error);
        if (isActive) {
          setLibraryError('Could not load the media library.');
        }
      } finally {
        if (isActive) {
          setIsLibraryLoading(false);
        }
      }
    }

    loadLibrary();

    return () => {
      isActive = false;
    };
  }, []);

  if (!draftProduct) {
    return null;
  }

  const handleUploadSelection = async event => {
    const files = event.target.files;
    const uploadedAssets = await actions.addImagesFromFiles(files);

    if (uploadedAssets?.length) {
      setLibraryAssets(currentAssets =>
        mergeLibraryAssets(
          currentAssets,
          uploadedAssets.map(asset => ({
            ...asset,
            createdAt: asset.createdAt || new Date().toISOString(),
            linkedProducts: asset.linkedProducts || 0,
          }))
        )
      );
      setActiveTab('gallery');
    }

    event.target.value = '';
  };

  const handleDropzoneUpload = async files => {
    const uploadedAssets = await actions.addImagesFromFiles(files);

    if (uploadedAssets?.length) {
      setLibraryAssets(currentAssets =>
        mergeLibraryAssets(
          currentAssets,
          uploadedAssets.map(asset => ({
            ...asset,
            createdAt: asset.createdAt || new Date().toISOString(),
            linkedProducts: asset.linkedProducts || 0,
          }))
        )
      );
      setActiveTab('gallery');
    }
  };

  const renderGalleryTab = () => (
    <>
      <AdminUploadDropzone
        className={styles.uploadZone}
        description="Drop files to upload and attach directly to this product gallery."
        onFilesSelected={handleDropzoneUpload}
        title="Drag and drop product media"
      />

      <div className={styles.actionRow}>
        <AdminButton leftIcon={<span className="material-symbols-outlined">upload</span>} onClick={() => uploadInputRef.current?.click()} size="sm" variant="primary">
          Upload to library
        </AdminButton>
        <AdminButton leftIcon={<span className="material-symbols-outlined">photo_library</span>} onClick={() => setActiveTab('library')} size="sm" variant="secondary">
          Open library
        </AdminButton>
        <AdminButton
          disabled={!previewImage || previewImage.id === draftProduct.featuredImageId}
          leftIcon={<span className="material-symbols-outlined">star</span>}
          onClick={() => previewImage && actions.setFeaturedImage(previewImage.id)}
          size="sm"
          variant="secondary"
        >
          Set featured
        </AdminButton>
        <AdminButton
          disabled={!previewImage}
          leftIcon={<span className="material-symbols-outlined">delete</span>}
          onClick={() => previewImage && actions.removeImage(previewImage.id)}
          size="sm"
          variant="danger"
        >
          Remove
        </AdminButton>
      </div>

      <div className={styles.thumbnailGrid}>
        {draftProduct.images.map((image, index) => (
          <div
            key={image.id}
            className={image.id === editor.previewImageId ? styles.thumbnailTileActive : styles.thumbnailTile}
            draggable
            onClick={() => actions.selectPreviewImage(image.id)}
            onDragEnd={() => {
              draggedImageIdRef.current = null;
            }}
            onDragOver={event => {
              event.preventDefault();
            }}
            onDragStart={() => {
              draggedImageIdRef.current = image.id;
            }}
            onDrop={event => {
              event.preventDefault();
              const draggedImageId = draggedImageIdRef.current;
              if (!draggedImageId || draggedImageId === image.id) {
                return;
              }

              const images = draftProduct.images;
              const fromIndex = images.findIndex(item => item.id === draggedImageId);
              const toIndex = images.findIndex(item => item.id === image.id);

              if (fromIndex === -1 || toIndex === -1) {
                return;
              }

              let steps = toIndex - fromIndex;
              while (steps !== 0) {
                actions.moveImage(draggedImageId, steps > 0 ? 'right' : 'left');
                steps += steps > 0 ? -1 : 1;
              }

              draggedImageIdRef.current = null;
            }}
            role="button"
            tabIndex={0}
          >
            <div className={styles.thumbnailTileImageWrap}>
              <Image alt={image.alt} className={styles.thumbnailImage} fill src={image.src} unoptimized />
              {image.id === editor.previewImageId ? (
                <span className={styles.selectedIndicator}>
                  <span className="material-symbols-outlined" aria-hidden="true">check</span>
                </span>
              ) : null}
            </div>
            <div className={styles.tileFooter}>
              <span className={styles.tilePosition}>{index + 1}</span>
              {image.id === draftProduct.featuredImageId ? <span className={styles.tileBadge}>Featured</span> : null}
            </div>
          </div>
        ))}

        <button className={styles.addTile} onClick={() => uploadInputRef.current?.click()} type="button">
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
    </>
  );

  const renderLibraryTab = () => (
    <>
      <div className={styles.libraryIntro}>
        <div>
          <p className={styles.libraryEyebrow}>Neon Media Library</p>
          <p className={styles.libraryText}>Uploads live in Prisma-backed storage so you can reuse them across products or manage everything on the dedicated Media page.</p>
        </div>
        <div className={styles.actionRow}>
          <AdminButton leftIcon={<span className="material-symbols-outlined">upload</span>} onClick={() => uploadInputRef.current?.click()} size="sm" variant="primary">
            Upload image
          </AdminButton>
          <AdminButton
            leftIcon={<span className="material-symbols-outlined">refresh</span>}
            onClick={() => {
              setIsLibraryLoading(true);
              setLibraryError('');
              fetch('/api/media?pageSize=72')
                .then(res => res.json())
                .then(json => {
                  if (!json.success) {
                    setLibraryError(json.error || 'Could not refresh the media library.');
                    return;
                  }

                  setLibraryAssets(json.data.assets || []);
                })
                .catch(error => {
                  console.error('[ProductMediaManager] media refresh failed', error);
                  setLibraryError('Could not refresh the media library.');
                })
                .finally(() => {
                  setIsLibraryLoading(false);
                });
            }}
            size="sm"
            variant="secondary"
          >
            Refresh
          </AdminButton>
          <Link className={`admin-btn admin-btn--secondary admin-btn--sm ${styles.actionButtonLink}`} href="/media">
            <span className="material-symbols-outlined">open_in_new</span>
            Open media page
          </Link>
        </div>
      </div>

      <AdminUploadDropzone
        className={styles.uploadZone}
        description="Drop files here to upload, then add them into this product's gallery."
        onFilesSelected={handleDropzoneUpload}
        title="Drag and drop to media library"
      />

      {libraryError ? <p className={styles.libraryError}>{libraryError}</p> : null}

      {isLibraryLoading ? (
        <div className={styles.libraryState}>Loading media library...</div>
      ) : libraryAssets.length ? (
        <div className={styles.libraryGrid}>
          {libraryAssets.map(asset => {
            const isInGallery = assetIdsInGallery.has(asset.id);

            return (
              <div className={isInGallery ? `${styles.libraryCard} ${styles.libraryCardSelected}` : styles.libraryCard} key={asset.id}>
                <div className={styles.libraryImageWrap}>
                  <Image
                    alt={asset.altText || asset.filename || 'Media library image'}
                    className={styles.libraryImage}
                    fill
                    src={asset.url}
                    unoptimized
                  />
                  {isInGallery ? (
                    <span className={styles.selectedIndicator}>
                      <span className="material-symbols-outlined" aria-hidden="true">check</span>
                    </span>
                  ) : null}
                </div>
                <div className={styles.libraryMeta}>
                  <p className={styles.libraryName}>{asset.filename || 'Untitled asset'}</p>
                  <div className={styles.libraryMetaRow}>
                    <span>{formatAssetDate(asset.createdAt)}</span>
                    <span>{asset.linkedProducts ? `${asset.linkedProducts} linked` : 'Unlinked'}</span>
                  </div>
                </div>
                <AdminButton
                  className={isInGallery ? styles.libraryButtonAdded : styles.libraryButton}
                  disabled={isInGallery}
                  onClick={() => {
                    actions.addImagesFromLibrary(asset);
                    setActiveTab('gallery');
                  }}
                  size="sm"
                  variant={isInGallery ? 'secondary' : 'primary'}
                >
                  {isInGallery ? 'In gallery' : 'Add to gallery'}
                </AdminButton>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.libraryState}>No uploads yet. Add your first product image to start the library.</div>
      )}
    </>
  );

  return (
    <div className={styles.mediaShell}>
      <div className={styles.tabRow}>
        <AdminButton
          className={styles.tabButton}
          onClick={() => setActiveTab('gallery')}
          size="sm"
          variant={activeTab === 'gallery' ? 'primary' : 'secondary'}
        >
          Gallery
        </AdminButton>
        <AdminButton
          className={styles.tabButton}
          onClick={() => setActiveTab('library')}
          size="sm"
          variant={activeTab === 'library' ? 'primary' : 'secondary'}
        >
          Media Library
        </AdminButton>
      </div>

      <input
        accept="image/*"
        hidden
        multiple
        onChange={handleUploadSelection}
        ref={uploadInputRef}
        type="file"
      />

      {activeTab === 'gallery' ? renderGalleryTab() : renderLibraryTab()}
    </div>
  );
}
