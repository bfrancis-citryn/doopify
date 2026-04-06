"use client";

import ProductMediaManager from './ProductMediaManager';
import ProductVariantEditor from './ProductVariantEditor';
import { useProductStore } from '../../context/ProductContext';
import { getProductStockLabel } from '../../lib/productUtils';
import styles from './ProductEditorDrawer.module.css';

const STATUS_OPTIONS = [
  { id: 'active', label: 'Active' },
  { id: 'draft', label: 'Draft' },
  { id: 'archived', label: 'Archived' },
];

function SectionCard({ eyebrow, title, children }) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionEyebrow}>{eyebrow}</p>
          <h3 className={`font-headline ${styles.sectionTitle}`}>{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ProductEditorDrawer() {
  const { editor, selectedProduct, formatMoney, actions } = useProductStore();
  const draftProduct = editor.mode === 'existing' ? selectedProduct || editor.draftProduct : editor.draftProduct;

  if (!draftProduct || !editor.isOpen) {
    return null;
  }

  const isSaveDisabled =
    editor.isSaving ||
    (editor.mode === 'existing' && !editor.hasUnsavedChanges);
  const inventoryHealth = getProductStockLabel({
    variants: draftProduct.variants,
    inventorySummary: editor.draftInventorySummary,
  });
  const draftStateLabel =
    editor.mode === 'new'
      ? 'New draft'
      : editor.hasUnsavedChanges
        ? 'Unsaved changes'
        : 'Saved';

  return (
    <div className={`custom-scrollbar ${styles.drawerShell}`}>
      <div className={styles.stickyHeader}>
        <div className={styles.headerIdentity}>
          <p className={styles.overline}>{editor.mode === 'new' ? 'New Product' : 'Product Editor'}</p>
          <div className={styles.headerTitleRow}>
            <h2 className={`font-headline ${styles.headerTitle}`}>{draftProduct.title || 'Untitled Product'}</h2>
            {editor.mode === 'new' || editor.hasUnsavedChanges ? (
              <span className={styles.dirtyBadge}>{draftStateLabel}</span>
            ) : (
              <span className={styles.cleanBadge}>{draftStateLabel}</span>
            )}
          </div>
        </div>

        <div className={styles.headerActions}>
          <label className={styles.autosaveToggle}>
            <input
              checked={editor.autosaveEnabled}
              onChange={event => actions.setAutosaveEnabled(event.target.checked)}
              type="checkbox"
            />
            <span>Autosave</span>
          </label>
          <button className={styles.ghostButton} onClick={() => actions.cancelDraftChanges()} type="button">
            Cancel
          </button>
          <button className={styles.ghostButton} onClick={() => actions.requestCloseEditor()} type="button">
            Close
          </button>
          <button
            className={styles.primaryButton}
            disabled={isSaveDisabled}
            onClick={() => actions.saveDraft()}
            type="button"
          >
            {editor.isSaving ? 'Saving...' : 'Save'}
          </button>
          <button className={styles.deleteButton} onClick={() => actions.requestDeleteProduct()} type="button">
            <span className="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>

      <div className={styles.drawerBody}>
        <SectionCard eyebrow="Basic Info" title="Product identity">
          <div className={styles.gridTwo}>
            <label className={styles.field}>
              <span>Title</span>
              <input onChange={event => actions.setDraftField('title', event.target.value)} type="text" value={draftProduct.title} />
              {editor.validationErrors.title ? <small className={styles.fieldError}>{editor.validationErrors.title}</small> : null}
            </label>
            <label className={styles.field}>
              <span>Primary SKU</span>
              <input onChange={event => actions.setDraftField('sku', event.target.value)} type="text" value={draftProduct.sku} />
              {editor.validationErrors.sku ? <small className={styles.fieldError}>{editor.validationErrors.sku}</small> : null}
            </label>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Description" title="Product description">
          <label className={styles.field}>
            <span>Description</span>
            <textarea onChange={event => actions.setDraftField('description', event.target.value)} rows={6} value={draftProduct.description} />
          </label>
        </SectionCard>

        <SectionCard eyebrow="Media" title="Product gallery">
          <ProductMediaManager />
        </SectionCard>

        <SectionCard eyebrow="Pricing" title="Base merchandising price">
          <div className={styles.gridTwo}>
            <label className={styles.field}>
              <span>Price</span>
              <input onChange={event => actions.setDraftField('basePrice', event.target.value)} type="text" value={draftProduct.basePrice} />
              {editor.validationErrors.basePrice ? <small className={styles.fieldError}>{editor.validationErrors.basePrice}</small> : null}
            </label>
            <label className={styles.field}>
              <span>Compare-at price</span>
              <input onChange={event => actions.setDraftField('compareAtPrice', event.target.value)} type="text" value={draftProduct.compareAtPrice} />
              {editor.validationErrors.compareAtPrice ? <small className={styles.fieldError}>{editor.validationErrors.compareAtPrice}</small> : null}
            </label>
          </div>

          <div className={styles.pricePreview}>
            <div>
              <p className={styles.metricLabel}>Live catalog price</p>
              <p className={`font-headline ${styles.metricValue}`}>{formatMoney(draftProduct.basePrice)}</p>
            </div>
            <div>
              <p className={styles.metricLabel}>Compare-at</p>
              <p className={`font-headline ${styles.metricSecondary}`}>{formatMoney(draftProduct.compareAtPrice)}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Inventory" title="Stock summary">
          <div className={styles.inventoryGrid}>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Total available</p>
              <p className={`font-headline ${styles.metricValue}`}>{editor.draftInventorySummary.totalAvailable}</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Inventory health</p>
              <p className={`font-headline ${styles.metricSecondary}`}>{inventoryHealth}</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Tracked variants</p>
              <p className={`font-headline ${styles.metricSecondary}`}>{draftProduct.variants.length}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Variants" title="Options and combinations">
          {editor.validationErrors.variants ? <p className={styles.fieldError}>{editor.validationErrors.variants}</p> : null}
          {editor.validationErrors.options ? <p className={styles.fieldError}>{editor.validationErrors.options}</p> : null}
          <ProductVariantEditor />
        </SectionCard>

        <SectionCard eyebrow="Organization" title="Category and tags">
          <div className={styles.gridTwo}>
            <label className={styles.field}>
              <span>Category</span>
              <input onChange={event => actions.setDraftField('category', event.target.value)} type="text" value={draftProduct.category} />
            </label>
            <label className={styles.field}>
              <span>Tags</span>
              <input onChange={event => actions.setDraftTagsFromText(event.target.value)} type="text" value={draftProduct.tags.join(', ')} />
            </label>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Product Status" title="Publishing state">
          <div className={styles.statusRow}>
            {STATUS_OPTIONS.map(option => (
              <button
                key={option.id}
                className={draftProduct.status === option.id ? styles.statusButtonActive : styles.statusButton}
                onClick={() => actions.setDraftField('status', option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
