"use client";

import React, { createContext, useContext, useState, useReducer } from 'react';

const ProductContext = createContext();

export function ProductProvider({ children }) {
  // Initial global state matching our mock data, but expanded with variants
  const [products, setProducts] = useState([
    {
      id: 1,
      name: 'Lumix Pro Wireless',
      image: '/images/product-1.jpg',
      active: true,
      variants: [
        { id: 101, name: 'Small', price: "58.00", available: 5 },
        { id: 102, name: 'Medium', price: "58.00", available: 10 },
      ]
    },
    {
      id: 2,
      name: 'Aether Chrono S1',
      image: '/images/product-2.jpg',
      active: false,
      variants: [
        { id: 201, name: 'Standard', price: "299.00", available: 3 },
      ]
    },
    {
      id: 3,
      name: 'Velox Run Trainer',
      image: '/images/product-3.jpg',
      active: false,
      variants: [
        { id: 301, name: 'Size 9', price: "120.00", available: 8 },
      ]
    },
    {
      id: 4,
      name: 'Titan X-Phone',
      image: '/images/product-4.jpg',
      active: false,
      variants: [
        { id: 401, name: '128GB', price: "999.00", available: 0 },
      ]
    },
  ]);

  // Derive inventory strictly from variant availability
  const getDerivedProducts = () => {
    return products.map(product => {
      const totalInventory = product.variants.reduce((sum, v) => sum + (parseInt(v.available) || 0), 0);
      
      let status = 'Available';
      let statusType = 'success';
      if (totalInventory === 0) {
        status = 'Out';
        statusType = 'error';
      } else if (totalInventory < 6) {
        status = 'Low';
        statusType = 'warning';
      }

      return {
        ...product,
        inventory: totalInventory,
        status,
        statusType
      };
    });
  };

  const updateProductVariants = (productId, newVariants) => {
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, variants: newVariants } : p
    ));
  };

  return (
    <ProductContext.Provider value={{
      products: getDerivedProducts(),
      updateProductVariants
    }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProductStore() {
  return useContext(ProductContext);
}
