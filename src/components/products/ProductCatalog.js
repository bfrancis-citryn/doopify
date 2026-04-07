"use client";

import Image from 'next/image';
import { useDeferredValue, useMemo } from 'react';
import {
  getProductFeaturedImage,
  getProductStockLabel,
  getProductTotalInventory,
  getProductVariantCount,
  productMatchesFilter,
  productMatchesSearch,
} from '../../lib/productUtils';
import { useProductStore } from '../../context/ProductContext';
import styles from './ProductCatalog.module.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'low-stock', label: 'Low Stock' },
  { id: 'out-of-stock', label: 'Out of Stock' },
  { id: 'draft', label: 'Draft' },
  { id: 'active', label: 'Active' },
];

const STATUS_LABELS = {
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived',
};

export default function ProductCatalog() {
  const { products, selectedProductId, searchQuery, activeFilter, editor, formatMoney, actions } = useProductStore();
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const visibleProducts = useMemo(
    () =>
      products.filter(
        product =>
          productMatchesFilter(product, activeFilter) &&
          productMatchesSearch(product, deferredSearchQuery)
      ),
    [activeFilter, deferredSearchQuery, products]
  );

  return (
    <section className={styles.catalogShell}>
      <div className={styles.catalogHeader}>
        <div className={styles.catalogHeaderTopRow}>
          <div className={styles.searchField}>
            <span className="material-symbols-outlined">search</span>
            <input
              aria-label="Search products"
              className={styles.searchInput}
              onChange={event => actions.setSearchQuery(event.target.value)}
              placeholder="Search products, SKUs, vendors, tags..."
              type="text"
              value={searchQuery}
            />
          </div>

          <button className={styles.newProductButton} onClick={() => actions.requestCreateProduct()} type="button">
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>
      </div>

      <div className={styles.filterRow}>
        {FILTERS.map(filter => (
          <button
            key={filter.id}
            className={activeFilter === filter.id ? styles.filterButtonActive : styles.filterButton}
            onClick={() => actions.setActiveFilter(filter.id)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className={`custom-scrollbar ${styles.listArea}`}>
        {!products.length ? (
          <div className={styles.emptyState}>
            <p className={`font-headline ${styles.emptyTitle}`}>No products yet</p>
            <p className={styles.emptyText}>Create your first product to start managing inventory in the slide-in editor.</p>
            <button className={styles.emptyAction} onClick={() => actions.requestCreateProduct()} type="button">
              Create product
            </button>
          </div>
        ) : null}

        {products.length > 0 && !visibleProducts.length ? (
          <div className={styles.emptyState}>
            <p className={`font-headline ${styles.emptyTitle}`}>No matching products</p>
            <p className={styles.emptyText}>Try a broader search or switch filters to explore the rest of the catalog.</p>
            <button className={styles.emptyAction} onClick={() => actions.setActiveFilter('all')} type="button">
              Clear filters
            </button>
          </div>
        ) : null}

        {visibleProducts.map(product => {
          const isSelected = selectedProductId === product.id || editor.draftProduct?.id === product.id;
          const featuredImage = getProductFeaturedImage(product);
          const totalInventory = getProductTotalInventory(product);
          const variantCount = getProductVariantCount(product);
          const stockLabel = getProductStockLabel(product);

          return (
            <button
              key={product.id}
              className={isSelected ? styles.productRowActive : styles.productRow}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                actions.requestSelectProduct(product.id);
              }}
              type="button"
            >
              <div className={styles.rowMedia}>
                {featuredImage ? (
                  <Image
                    alt={featuredImage.alt}
                    className={styles.thumbnail}
                    fill
                    src={featuredImage.src}
                    unoptimized
                  />
                ) : (
                  <div className={styles.thumbnailPlaceholder}>
                    <span className="material-symbols-outlined">image</span>
                  </div>
                )}
              </div>

              <div className={styles.rowContent}>
                <div className={styles.rowTop}>
                  <div>
                    <p className={`font-headline ${styles.productTitle}`}>{product.title}</p>
                    <p className={styles.productMeta}>{product.category || 'Uncategorized'}</p>
                  </div>
                  <span className={`${styles.statusChip} ${styles[`status_${product.status}`]}`}>
                    {STATUS_LABELS[product.status]}
                  </span>
                </div>

                <div className={styles.rowBottom}>
                  <span className={`${styles.stockPill} ${styles[`stock_${product.inventorySummary.stockStatus}`]}`}>{stockLabel}</span>
                  <span>{totalInventory} in stock</span>
                  <span>{variantCount} variant{variantCount > 1 ? 's' : ''}</span>
                  <span>{formatMoney(product.basePrice)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className={styles.catalogFooter}>
        <span>{visibleProducts.length} visible</span>
        <span>{products.length} total products</span>
      </div>
    </section>
  );
}
