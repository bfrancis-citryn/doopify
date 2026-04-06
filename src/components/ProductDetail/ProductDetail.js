"use client";

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useProductStore } from '../../context/ProductContext';
import styles from './ProductDetail.module.css';

const RANK_BY_CATEGORY = {
  Electronics: '#04',
  Wearables: '#07',
  Footwear: '#09',
  Mobile: '#02',
};

export default function ProductDetail({ onClose, product }) {
  const { updateProductDetails } = useProductStore();
  const [draft, setDraft] = useState(() => ({
    name: product?.name || '',
    inventory: String(product?.inventory ?? 0),
    description: product?.description || '',
  }));
  const [isSaved, setIsSaved] = useState(true);

  const warehouseCards = product?.warehouse || [];
  const productPrice = product?.price || '0.00';
  const categoryRank = RANK_BY_CATEGORY[product?.category] || '#11';

  const totalUnits = useMemo(() => {
    const parsedValue = Number.parseInt(draft.inventory, 10);
    return Number.isNaN(parsedValue) ? 0 : Math.max(0, parsedValue);
  }, [draft.inventory]);

  const draftStatus = useMemo(() => {
    if (totalUnits === 0) {
      return { label: 'Out', type: 'error' };
    }

    if (totalUnits < 6) {
      return { label: 'Low', type: 'warning' };
    }

    return { label: 'Available', type: 'success' };
  }, [totalUnits]);

  if (!product) {
    return null;
  }

  const handleFieldChange = (field, value) => {
    setDraft(current => ({ ...current, [field]: value }));
    setIsSaved(false);
  };

  const handleUpdateStore = () => {
    updateProductDetails(product.id, draft);
    setIsSaved(true);
  };

  return (
    <div className={`custom-scrollbar refraction-edge ${styles.container}`}>
      <div className={styles.innerContent}>
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <p className={styles.overline}>Selected Product</p>
            <h3 className={`font-headline ${styles.headerTitle}`}>Product Details</h3>
            <p className={styles.headerText}>Review and update the title, current stock, and narrative without leaving the catalog.</p>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.iconBtn} onClick={onClose} title="Close panel" type="button">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <section className={styles.heroCard}>
          <div className={styles.heroTopRow}>
            <div className={styles.heroIdentity}>
              <div className={styles.imageCard}>
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className={styles.image}
                />
              </div>

              <div className={styles.identityContent}>
                <p className={styles.overline}>Selected Product</p>
                <input
                  className={`font-headline ${styles.nameInput}`}
                  type="text"
                  value={draft.name}
                  onChange={event => handleFieldChange('name', event.target.value)}
                  aria-label="Product title"
                />
                <div className={styles.badges}>
                  <span className={styles.categoryBadge}>{product.category}</span>
                  <span className={styles.skuBadge}>SKU: {product.sku}</span>
                </div>
              </div>
            </div>

            <div className={styles.actionBtns}>
              <button className={styles.iconBtn} type="button" title="Edit product">
                <span className="material-symbols-outlined">edit</span>
              </button>
              <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} type="button" title="Delete product">
                <span className="material-symbols-outlined">delete</span>
              </button>
              <button
                className={styles.primaryBtn}
                onClick={handleUpdateStore}
                disabled={isSaved}
                type="button"
              >
                Update Inventory
              </button>
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Current Price</p>
              <p className={`font-headline ${styles.statValue}`}>${productPrice}</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Total Units</p>
              <div className={styles.inventoryEditor}>
                <input
                  className={`font-headline ${styles.inventoryInput}`}
                  type="number"
                  min="0"
                  value={draft.inventory}
                  onChange={event => handleFieldChange('inventory', event.target.value)}
                  aria-label="Inventory count"
                />
                <span className={`${styles.statusPill} ${styles[`status_${draftStatus.type}`]}`}>{draftStatus.label}</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Category Rank</p>
              <p className={`font-headline ${styles.statValue}`}>{categoryRank}</p>
            </div>
          </div>
        </section>

        <section className={styles.warehouseBreakdown}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionLabel}>Warehouse Breakdown</p>
              <h4 className={`font-headline ${styles.sectionTitle}`}>Live stock distribution</h4>
            </div>
            <button className={styles.manageLink} type="button">Manage Locations</button>
          </div>

          <div className={styles.breakdownCards}>
            {warehouseCards.map((card, index) => (
              <div key={card.title} className={styles.warehouseCard}>
                <div className={styles.warehouseIcon}>
                  <span className="material-symbols-outlined">
                    {index === 2 ? 'local_shipping' : 'inventory_2'}
                  </span>
                </div>
                <div className={styles.warehouseContent}>
                  <div>
                    <div className={styles.warehouseTitle}>{card.title}</div>
                    <div className={styles.warehouseSubtitle}>{card.subtitle}</div>
                  </div>
                  <div className={styles.warehouseValue}>{card.value}</div>
                </div>
              </div>
            ))}
            <button className={styles.warehouseCardEmpty} type="button">
              <span className="material-symbols-outlined">add_location_alt</span>
              <span>Add Location</span>
            </button>
          </div>
        </section>

        <section className={styles.narrativeCard}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionLabel}>Product Narrative</p>
              <h4 className={`font-headline ${styles.sectionTitle}`}>Customer-facing description</h4>
            </div>
            <p className={styles.narrativeMeta}>{totalUnits} units currently available</p>
          </div>

          <textarea
            className={styles.descriptionInput}
            value={draft.description}
            onChange={event => handleFieldChange('description', event.target.value)}
            rows={6}
            aria-label="Product description"
          />
        </section>
      </div>
    </div>
  );
}
