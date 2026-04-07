"use client";

import ProductsWorkspace from '../../components/products/ProductsWorkspace';
import { ProductProvider } from '../../context/ProductContext';

export default function ProductsPage() {
  return (
    <ProductProvider>
      <ProductsWorkspace />
    </ProductProvider>
  );
}
