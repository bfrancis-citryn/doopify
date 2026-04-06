"use client";

import Image from 'next/image';
import { useRef } from 'react';
import { useProductStore } from '../../context/ProductContext';
import styles from './ProductMediaManager.module.css';

export default function ProductMediaManager() {
  const { editor, actions } = useProductStore();
  const uploadInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const replaceTargetRef = useRef(null);
  const draftProduct = editor.draftProduct;

  if (!draftProduct) {
    return null;
  }

  const previewImage =
    draftProduct.images.find(image => image.id === editor.previewImageId) ||
    editor.draftFeaturedImage ||
    null;

  const handleReplaceFileChange = event => {
    const file = event.target.files?.[0];
    const imageId = replaceTargetRef.current;

    if (file && imageId) {
      actions.replaceImageWithFile(imageId, file);
    }

    event.target.value = '';
    replaceTargetRef.current = null;
  };

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
            <p className={styles.previewEmptyText}>Upload files or add a sample image to start building the gallery.</p>
          </div>
        )}
      </div>

      <div className={styles.actionRow}>
        <button className={styles.actionButtonPrimary} onClick={() => uploadInputRef.current?.click()} type="button">
          <span className="material-symbols-outlined">upload</span>
          Upload photo
        </button>
        <button className={styles.actionButton} onClick={() => actions.addSampleImage()} type="button">
          <span className="material-symbols-outlined">image</span>
          Add sample
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
      <input
        accept="image/*"
        hidden
        onChange={handleReplaceFileChange}
        ref={replaceInputRef}
        type="file"
      />

      <div className={styles.thumbnailGrid}>
        {draftProduct.images.map((image, index) => (
          <div key={image.id} className={image.id === editor.previewImageId ? styles.thumbnailCardActive : styles.thumbnailCard}>
            <button className={styles.thumbnailButton} onClick={() => actions.selectPreviewImage(image.id)} type="button">
              <Image alt={image.alt} className={styles.thumbnailImage} fill src={image.src} unoptimized />
            </button>

            <div className={styles.thumbnailMeta}>
              <span className={styles.thumbnailLabel}>
                {image.id === draftProduct.featuredImageId ? 'Main image' : `Image ${index + 1}`}
              </span>
              <div className={styles.thumbnailActions}>
                <button className={styles.iconButton} onClick={() => actions.setFeaturedImage(image.id)} title="Set as main image" type="button">
                  <span className="material-symbols-outlined">star</span>
                </button>
                <button
                  className={styles.iconButton}
                  onClick={() => {
                    replaceTargetRef.current = image.id;
                    replaceInputRef.current?.click();
                  }}
                  title="Replace image"
                  type="button"
                >
                  <span className="material-symbols-outlined">sync</span>
                </button>
                <button className={styles.iconButton} onClick={() => actions.replaceImageWithSample(image.id)} title="Cycle sample image" type="button">
                  <span className="material-symbols-outlined">shuffle</span>
                </button>
                <button className={styles.iconButton} onClick={() => actions.moveImage(image.id, 'left')} title="Move image left" type="button">
                  <span className="material-symbols-outlined">west</span>
                </button>
                <button className={styles.iconButton} onClick={() => actions.moveImage(image.id, 'right')} title="Move image right" type="button">
                  <span className="material-symbols-outlined">east</span>
                </button>
                <button className={`${styles.iconButton} ${styles.iconButtonDanger}`} onClick={() => actions.removeImage(image.id)} title="Remove image" type="button">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
