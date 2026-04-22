import { notFound } from 'next/navigation';
import OrderDetailClientPage from '@/components/orders/OrderDetailClientPage';

export default async function OrderDetailPage({ params }) {
  const resolvedParams = await params;
  const orderNumber = resolvedParams?.orderNumber;

  if (!orderNumber) {
    notFound();
  }

  return <OrderDetailClientPage orderNumber={orderNumber} />;
}
