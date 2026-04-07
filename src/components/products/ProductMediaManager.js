"use client";

import Image from 'next/image';
import { useRef } from 'react';
import { useProductStore } from '../../context/ProductContext';
import styles from './ProductMediaManager.module.css';

export default function ProductMediaManager() {
  const { editor, actions } = useProductStore();
  const uploadInputRef = useRef(null);
  const draggedImageIdRef = useRef(null);
  const draftProduct = editor.draftProduct;

  if (!draftProduct) {
    return null;
  }

  const previewImage =
    draftProduct.images.find(image => image.id === editor.previewImageId) ||
    editor.draftFeaturedImage ||
    null;

  return (
    <div className={styles.mediaShell}>
      <div className={styles.previewPanel}>
        {previewImage ? (
          <Image
            alt={previewImage.alt}
            className={styles.previewImage}
            fill
            src={previewImage.src}
            unoptimized
          />
        ) : (
          <div className={styles.previewEmpty}>
            <span className="material-symbols-outlined">image</span>
            <p className={`font-headline ${styles.previewEmptyTitle}`}>No media yet</p>
            <p className={styles.previewEmptyText}>Upload files to start building the gallery.</p>
          </div>
        )}
      </div>

      <div className={styles.actionRow}>
        <button className={styles.actionButtonPrimary} onClick={() => uploadInputRef.current?.click()} type="button">
          <span className="material-symbols-outlined">upload</span>
          Upload photo
        </button>
      </div>

      <input
        accept="image/*"
        hidden
        multiple
        onChange={event => actions.addImagesFromFiles(event.target.files)}
        ref={uploadInputRef}
        type="file"
      />

      <div className={styles.thumbnailGrid}>
        {draftProduct.images.map((image, index) => (
          <div
            key={image.id}
            className={image.id === editor.previewImageId ? styles.thumbnailTileActive : styles.thumbnailTile}
            draggable
            onClick={() => actions.selectPreviewImage(image.id)}
            onDragStart={() => {
              draggedImageIdRef.current = image.id;
            }}
            onDragOver={event => {
              event.preventDefault();
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
            onDragEnd={() => {
              draggedImageIdRef.current = null;
            }}
            role="button"
            tabIndex={0}
          >
            <div className={styles.thumbnailTileImageWrap}>
              <Image alt={image.alt} className={styles.thumbnailImage} fill src={image.src} unoptimized />
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
    </div>
  );
}
