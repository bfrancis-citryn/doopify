"use client";

import { useState } from 'react';
import Sidebar from '../components/Sidebar/Sidebar';
import Header from '../components/Header/Header';
import ProductList from '../components/ProductList/ProductList';
import ProductDetail from '../components/ProductDetail/ProductDetail';
import { ProductProvider, useProductStore } from '../context/ProductContext';
import styles from './page.module.css';

export default function ProductsPage() {
  return (
    <ProductProvider>
      <ProductsApp />
    </ProductProvider>
  );
}

function ProductsApp() {
  const [selectedProductId, setSelectedProductId] = useState(null);
  const { products } = useProductStore();
  const selectedProduct = products.find(p => p.id === selectedProductId) || null;

  return (
    <div className={styles.appContainer}>
      <Sidebar />
      <div className={styles.mainCanvas}>
        <Header />
        
        <div className={styles.viewContainer}>
          <div className={styles.consoleHeader}>
            <div>
              <p className={`font-label ${styles.consoleOverline}`}>Inventory Console</p>
              <h2 className={`font-headline ${styles.consoleTitle}`}>Products Catalog</h2>
            </div>
            <div className={styles.consoleActions}>
              <button className={styles.actionBtn}>
                <span className="material-symbols-outlined text-base">file_download</span> Export
              </button>
              <button className={styles.actionBtn}>
                <span className="material-symbols-outlined text-base">file_upload</span> Import
              </button>
              <button className={styles.primaryActionBtn}>
                <span className="material-symbols-outlined text-base">add</span> New Product
              </button>
            </div>
          </div>
          
          <div className={styles.splitView}>
            <ProductList 
              onSelect={(p) => setSelectedProductId(p.id)} 
              selectedProductId={selectedProductId} 
            />
            
            <div className={`${styles.detailPanel} ${selectedProduct ? styles.detailPanelOpen : ''}`}>
              <ProductDetail key={selectedProduct?.id || 'empty'} onClose={() => setSelectedProductId(null)} product={selectedProduct} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
