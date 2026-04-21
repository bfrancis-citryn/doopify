import { notFound } from 'next/navigation';
import ProductDetail from './ProductDetail';
import { getProductByHandle } from '@/server/services/product.service';

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) return { title: 'Not Found' };
  return {
    title: `${product.title} — Doopify`,
    description: product.description || `Shop ${product.title}`,
  };
}

export default async function ProductPage({ params }) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
