import Image from 'next/image';
import { useState } from 'react';
import { useProductStore } from '../../context/ProductContext';
import styles from './ProductList.module.css';

export default function ProductList({ onSelect, selectedProductId }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const { products } = useProductStore();

  const filteredProducts = products.filter(product => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Available') return product.inventory >= 6;
    if (activeFilter === 'Low') return product.inventory > 0 && product.inventory < 6;
    if (activeFilter === 'Out') return product.inventory === 0;
    return true;
  });

  return (
    <div className={styles.container}>
      <div className={styles.filters}>
        <div className={styles.filterBtnGroup}>
          <button 
            className={activeFilter === 'All' ? styles.filterActive : styles.filterOutline}
            onClick={() => setActiveFilter('All')}
          >
            All
          </button>
          <button 
            className={activeFilter === 'Available' ? styles.filterActive : styles.filterOutline}
            onClick={() => setActiveFilter('Available')}
          >
            Available
          </button>
          <button 
            className={activeFilter === 'Low' ? styles.filterActive : styles.filterOutline}
            onClick={() => setActiveFilter('Low')}
          >
            Low
          </button>
          <button 
            className={activeFilter === 'Out' ? styles.filterActive : styles.filterOutline}
            onClick={() => setActiveFilter('Out')}
          >
            Out
          </button>
        </div>
      </div>

      <div className={`custom-scrollbar ${styles.productList}`}>
        {filteredProducts.map(product => {
          const isActive = selectedProductId === product.id;
          return (
          <div 
            key={product.id} 
            className={isActive ? styles.productItemActive : styles.productItem}
            onClick={() => onSelect(product)}
          >
            <div className={styles.imageContainer}>
              <Image 
                src={product.image} 
                alt={product.name} 
                fill
                className={styles.image} 
              />
            </div>
            <div className={styles.detailContainer}>
              <p className={`font-headline font-bold text-xs truncate ${isActive ? styles.textActive : styles.textNormal}`}>
                {product.name}
              </p>
              <div className={styles.statusGroup}>
                <span className={`${styles.statusDot} ${styles[`dot_${product.statusType}`]}`}></span>
                <span className={`${styles.statusText} ${styles[`text_${product.statusType}`]}`}>
                  {product.status} ({product.inventory})
                </span>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <p>{filteredProducts.length} of {products.length} products</p>
      </div>
    </div>
  );
}
