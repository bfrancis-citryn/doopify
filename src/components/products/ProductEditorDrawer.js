"use client";

import ProductMediaManager from './ProductMediaManager';
import ProductVariantEditor from './ProductVariantEditor';
import { useProductStore } from '../../context/ProductContext';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminDrawer from '../admin/ui/AdminDrawer';
import AdminSavedState from '../admin/ui/AdminSavedState';
import styles from './ProductEditorDrawer.module.css';

const STATUS_OPTIONS = [
  { id: 'active', label: 'Active' },
  { id: 'draft', label: 'Draft' },
  { id: 'archived', label: 'Archived' },
];

function SectionCard({ eyebrow, title, children }) {
  return (
    <AdminCard className={styles.sectionCard} spotlight variant="card">
      <p className={styles.sectionEyebrow}>{eyebrow}</p>
      <h3 className={`font-headline ${styles.sectionTitle}`}>{title}</h3>
      {children}
    </AdminCard>
  );
}

export default function ProductEditorDrawer() {
  const { editor, formatMoney, actions } = useProductStore();
  const draftProduct = editor.draftProduct;

  if (!draftProduct || !editor.isOpen) {
    return null;
  }

  const isSaveDisabled = editor.isSaving || (editor.mode === 'existing' && !editor.hasUnsavedChanges);
  const title = draftProduct.title || 'Untitled Product';
  const saveState = editor.isSaving ? 'saving' : editor.hasUnsavedChanges ? 'dirty' : 'saved';

  const tabs = [
    {
      id: 'basic',
      label: 'Basic',
      content: (
        <div className={styles.drawerBody}>
          <SectionCard eyebrow="Basic" title="Product identity">
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>Title</span>
                <input onChange={event => actions.setDraftField('title', event.target.value)} type="text" value={draftProduct.title} />
              </label>
              <label className={styles.field}>
                <span>Primary SKU</span>
                <input onChange={event => actions.setDraftField('sku', event.target.value)} type="text" value={draftProduct.sku} />
              </label>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Description" title="Product description">
            <label className={styles.field}>
              <span>Description</span>
              <textarea onChange={event => actions.setDraftField('description', event.target.value)} rows={5} value={draftProduct.description} />
            </label>
          </SectionCard>

          <SectionCard eyebrow="Pricing" title="Base merchandising price">
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>Price</span>
                <input onChange={event => actions.setDraftField('basePrice', event.target.value)} type="text" value={draftProduct.basePrice} />
              </label>
              <label className={styles.field}>
                <span>Compare-at price</span>
                <input onChange={event => actions.setDraftField('compareAtPrice', event.target.value)} type="text" value={draftProduct.compareAtPrice} />
              </label>
            </div>
            <div className={styles.pricePreview}>
              <div>
                <p className={styles.metricLabel}>Live price</p>
                <p className={styles.metricValue}>{formatMoney(draftProduct.basePrice)}</p>
              </div>
              <div>
                <p className={styles.metricLabel}>Compare-at</p>
                <p className={styles.metricSecondary}>{formatMoney(draftProduct.compareAtPrice)}</p>
              </div>
            </div>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'media',
      label: 'Media',
      content: (
        <div className={styles.drawerBody}>
          <SectionCard eyebrow="Media" title="Product gallery">
            <ProductMediaManager />
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'variants',
      label: 'Variants',
      content: (
        <div className={styles.drawerBody}>
          <SectionCard eyebrow="Variants" title="Options and combinations">
            <ProductVariantEditor />
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'seo',
      label: 'SEO',
      content: (
        <div className={styles.drawerBody}>
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
            <div className={styles.statusRow}>
              {STATUS_OPTIONS.map(option => (
                <AdminButton key={option.id} onClick={() => actions.setDraftField('status', option.id)} size="sm" variant={draftProduct.status === option.id ? 'primary' : 'secondary'}>
                  {option.label}
                </AdminButton>
              ))}
            </div>
          </SectionCard>
        </div>
      ),
    },
  ];

  return (
    <AdminDrawer
      actions={(
        <>
          <AdminButton onClick={() => actions.cancelDraftChanges()} size="sm" variant="ghost">Cancel</AdminButton>
          <AdminButton disabled={isSaveDisabled} loading={editor.isSaving} onClick={() => actions.saveDraft()} size="sm" variant="primary">Save</AdminButton>
        </>
      )}
      className={`admin-spotlight ${styles.drawer}`}
      contextItems={[
        { label: 'Products' },
        { label: title, current: true },
        { label: editor.mode === 'new' ? 'New draft' : draftProduct.status === 'active' ? 'Active' : 'Draft' },
      ]}
      footer={<AdminSavedState savedAgoText="just now" state={saveState} />}
      onClose={() => actions.requestCloseEditor()}
      open={editor.isOpen}
      subtitle=""
      tabs={tabs}
      title={title}
    />
  );
}
