"use client";

import { createContext, useContext, useState } from 'react';

const ProductContext = createContext();

export function ProductProvider({ children }) {
  // Initial global state matching our mock data, but expanded with variants and product detail metadata
  const [products, setProducts] = useState([
    {
      id: 1,
      name: 'Lumix Pro Wireless',
      category: 'Electronics',
      sku: 'LX-2024-W1',
      price: '299.00',
      inventory: 124,
      image: '/images/product-1.jpg',
      active: true,
      description: 'The Lumix Pro Wireless headphones define the next generation of acoustic engineering with active noise cancellation and a refined silver-matte finish.',
      warehouse: [
        { title: 'Warehouse A (Global)', subtitle: 'Main distribution', value: 84 },
        { title: 'New York Showroom', subtitle: 'Retail display', value: 12 },
        { title: 'In Transit', subtitle: 'Stock replenishment', value: 28 },
      ],
      variants: [
        { id: 101, name: 'Small', price: '58.00', available: 5 },
        { id: 102, name: 'Medium', price: '58.00', available: 10 },
      ]
    },
    {
      id: 2,
      name: 'Aether Chrono S1',
      category: 'Wearables',
      sku: 'AE-2024-C1',
      price: '299.00',
      inventory: 22,
      image: '/images/product-2.jpg',
      active: false,
      description: 'Aether Chrono S1 brings intelligent health tracking and premium design together for a seamless wearable experience.',
      warehouse: [
        { title: 'Warehouse A (Global)', subtitle: 'Main distribution', value: 46 },
        { title: 'New York Showroom', subtitle: 'Retail display', value: 9 },
        { title: 'In Transit', subtitle: 'Stock replenishment', value: 13 },
      ],
      variants: [
        { id: 201, name: 'Standard', price: '299.00', available: 3 },
      ]
    },
    {
      id: 3,
      name: 'Velox Run Trainer',
      category: 'Footwear',
      sku: 'VX-2024-R3',
      price: '120.00',
      inventory: 38,
      image: '/images/product-3.jpg',
      active: false,
      description: 'The Velox Run Trainer delivers superior cushioning and a supportive fit for distance runners and daily athletes.',
      warehouse: [
        { title: 'Warehouse A (Global)', subtitle: 'Main distribution', value: 68 },
        { title: 'New York Showroom', subtitle: 'Retail display', value: 18 },
        { title: 'In Transit', subtitle: 'Stock replenishment', value: 6 },
      ],
      variants: [
        { id: 301, name: 'Size 9', price: '120.00', available: 8 },
      ]
    },
    {
      id: 4,
      name: 'Titan X-Phone',
      category: 'Mobile',
      sku: 'TX-2024-X7',
      price: '999.00',
      inventory: 0,
      image: '/images/product-4.jpg',
      active: false,
      description: 'Titan X-Phone pairs cutting-edge performance with a bold display and premium camera system.',
      warehouse: [
        { title: 'Warehouse A (Global)', subtitle: 'Main distribution', value: 0 },
        { title: 'New York Showroom', subtitle: 'Retail display', value: 0 },
        { title: 'In Transit', subtitle: 'Stock replenishment', value: 0 },
      ],
      variants: [
        { id: 401, name: '128GB', price: '999.00', available: 0 },
      ]
    },
  ]);

  const syncWarehouseWithInventory = (warehouse = [], inventory) => {
    if (!warehouse.length) {
      return warehouse;
    }

    if (inventory <= 0) {
      return warehouse.map(card => ({ ...card, value: 0 }));
    }

    const currentTotal = warehouse.reduce((sum, card) => sum + (Number(card.value) || 0), 0);
    if (currentTotal <= 0) {
      const base = Math.floor(inventory / warehouse.length);
      let remainder = inventory % warehouse.length;

      return warehouse.map(card => {
        const nextValue = base + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
        return { ...card, value: nextValue };
      });
    }

    let remaining = inventory;

    return warehouse.map((card, index) => {
      if (index === warehouse.length - 1) {
        return { ...card, value: remaining };
      }

      const nextValue = Math.round(((Number(card.value) || 0) / currentTotal) * inventory);
      remaining -= nextValue;
      return { ...card, value: nextValue };
    });
  };

  const getDerivedProducts = () => {
    return products.map(product => {
      const fallbackInventory = product.variants.reduce((sum, v) => sum + (parseInt(v.available, 10) || 0), 0);
      const totalInventory = Number.isFinite(product.inventory) ? product.inventory : fallbackInventory;
      
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
      p.id === productId
        ? {
            ...p,
            variants: newVariants,
            inventory: newVariants.reduce((sum, variant) => sum + (parseInt(variant.available, 10) || 0), 0),
          }
        : p
    ));
  };

  const updateProductDetails = (productId, updates) => {
    setProducts(prev =>
      prev.map(product => {
        if (product.id !== productId) {
          return product;
        }

        const nextInventory = Math.max(0, Number.parseInt(updates.inventory, 10) || 0);

        return {
          ...product,
          name: updates.name,
          description: updates.description,
          inventory: nextInventory,
          warehouse: syncWarehouseWithInventory(product.warehouse, nextInventory),
        };
      })
    );
  };

  return (
    <ProductContext.Provider value={{
      products: getDerivedProducts(),
      updateProductVariants,
      updateProductDetails,
    }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProductStore() {
  return useContext(ProductContext);
}
