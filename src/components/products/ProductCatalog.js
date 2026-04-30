"use client";

import Image from 'next/image';
import { useDeferredValue, useMemo } from 'react';
import {
  getComputedProductStateMeta,
  getProductFeaturedImage,
  getProductStockLabel,
  getProductVariantCount,
  productMatchesFilter,
  productMatchesSearch,
} from '../../lib/productUtils';
import { useProductStore } from '../../context/ProductContext';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminDropdown from '../admin/ui/AdminDropdown';
import AdminSkeleton from '../admin/ui/AdminSkeleton';
import AdminStatusChip from '../admin/ui/AdminStatusChip';
import AdminTable from '../admin/ui/AdminTable';
import styles from './ProductCatalog.module.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'low-stock', label: 'Low Stock' },
  { id: 'out-of-stock', label: 'Out of Stock' },
  { id: 'draft', label: 'Draft' },
  { id: 'active', label: 'Active' },
];

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

  const isLoading = !editor.draftProduct && products.length === 0;

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: product => {
        const featuredImage = getProductFeaturedImage(product);
        return (
          <div className={styles.productCell}>
            <div className={styles.rowMedia}>
              {featuredImage ? (
                <Image alt={featuredImage.alt} className={styles.thumbnail} fill src={featuredImage.src} unoptimized />
              ) : (
                <div className={styles.thumbnailPlaceholder}>
                  <span className="material-symbols-outlined">image</span>
                </div>
              )}
            </div>
            <div className={styles.rowContent}>
              <p className={`font-headline ${styles.productTitle}`}>{product.title}</p>
              <p className={styles.productMeta}>{product.category || 'Uncategorized'}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: product => {
        const state = getComputedProductStateMeta(product);
        return (
          <AdminStatusChip tone={state.tone}>
            {state.label}
          </AdminStatusChip>
        );
      },
    },
    {
      key: 'inventory',
      header: 'Inventory',
      render: product => {
        const stockStatus = product.inventorySummary.stockStatus;
        const stockLabel = getProductStockLabel(product);
        return (
          <AdminStatusChip tone={stockStatus === 'available' ? 'success' : stockStatus === 'low-stock' ? 'warning' : 'danger'}>
            {stockLabel}
          </AdminStatusChip>
        );
      },
    },
    {
      key: 'variants',
      header: 'Variants',
      render: product => {
        const variantCount = getProductVariantCount(product);
        return `${variantCount} variant${variantCount > 1 ? 's' : ''}`;
      },
    },
    {
      key: 'price',
      header: 'Price',
      render: product => formatMoney(product.basePrice),
    },
    {
      key: 'actions',
      header: '',
      render: product => (
        <div onClick={event => event.stopPropagation()}>
          <AdminDropdown
            align="end"
            trigger={(
              <button
                aria-label="Product actions"
                className={styles.rowActionButton}
                onClick={event => event.stopPropagation()}
                type="button"
              >
                <span className="material-symbols-outlined" aria-hidden="true">more_horiz</span>
              </button>
            )}
          >
            <button onClick={() => actions.requestSelectProduct(product.id)} type="button">
              Open product
            </button>
            <button onClick={() => actions.requestDuplicateProduct(product.id)} type="button">
              Duplicate product
            </button>
          </AdminDropdown>
        </div>
      ),
      cellClassName: styles.actionsCell,
      headerClassName: styles.actionsHeader,
    },
  ];

  return (
    <AdminCard className={`admin-spotlight ${styles.catalogShell}`} variant="panel">
      <div className={styles.catalogHeader}>
        <div className={styles.catalogHeaderTopRow}>
          <div className={`admin-card admin-card--inset admin-spotlight ${styles.searchField}`}>
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

          <AdminButton leftIcon={<span className="material-symbols-outlined">add</span>} onClick={() => actions.requestCreateProduct()} size="sm" variant="primary">
            Add product
          </AdminButton>
        </div>
      </div>

      <div className={styles.filterRow}>
        {FILTERS.map(filter => (
          <AdminButton
            key={filter.id}
            className={activeFilter === filter.id ? styles.filterButtonActive : styles.filterButton}
            onClick={() => actions.setActiveFilter(filter.id)}
            size="sm"
            type="button"
            variant={activeFilter === filter.id ? 'primary' : 'secondary'}
          >
            {filter.label}
          </AdminButton>
        ))}
      </div>

      <div className={`custom-scrollbar ${styles.listArea}`}>
        {isLoading ? <AdminSkeleton rows={6} variant="table" /> : null}

        {!isLoading && !products.length ? (
          <div className={styles.emptyState}>
            <p className={`font-headline ${styles.emptyTitle}`}>No products yet</p>
            <p className={styles.emptyText}>Create your first product to start managing inventory in the slide-in editor.</p>
            <AdminButton onClick={() => actions.requestCreateProduct()} variant="primary">
              Create product
            </AdminButton>
          </div>
        ) : null}

        {!isLoading && products.length > 0 && !visibleProducts.length ? (
          <div className={styles.emptyState}>
            <p className={`font-headline ${styles.emptyTitle}`}>No matching products</p>
            <p className={styles.emptyText}>Try a broader search or switch filters to explore the rest of the catalog.</p>
            <AdminButton onClick={() => actions.setActiveFilter('all')} variant="secondary">
              Clear filters
            </AdminButton>
          </div>
        ) : null}

        {!isLoading && visibleProducts.length > 0 ? (
          <AdminTable
            columns={columns}
            emptyDescription="Try changing filters or creating a new product."
            emptyTitle="No products"
            getRowId={product => product.id}
            onRowClick={product => actions.requestSelectProduct(product.id)}
            rows={visibleProducts}
            selectedId={selectedProductId || editor.draftProduct?.id || null}
          />
        ) : null}
      </div>

      <div className={styles.catalogFooter}>
        <span>{visibleProducts.length} visible</span>
        <span>{products.length} total products</span>
      </div>
    </AdminCard>
  );
}
