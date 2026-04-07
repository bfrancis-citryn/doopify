"use client";

import { createContext, useContext, useMemo, useState } from 'react';
import { createSeedProducts } from '../lib/productUtils';

const ProductsContext = createContext(null);

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState(createSeedProducts());

  const updateProduct = (productId, updater) => {
    setProducts(current => current.map(product => (product.id === productId ? updater(product) : product)));
  };

  const value = useMemo(
    () => ({
      products,
      setProducts,
      updateProduct,
    }),
    [products]
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error('useProducts must be used within ProductsProvider');
  }

  return context;
}
