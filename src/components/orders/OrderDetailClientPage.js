"use client";

import AppShell from '../AppShell';
import { useOrders } from '../../context/OrdersContext';
import OrderDetailView from './OrderDetailView';

export default function OrderDetailClientPage({ orderNumber }) {
  const { orders, updateOrder } = useOrders();
  const normalizedOrderNumber = `#${String(orderNumber).replace(/^#/, '')}`;
  const order = orders.find(entry => entry.orderNumber === normalizedOrderNumber);

  return (
    <AppShell
      onCreateOrder={() => {}}
      onNotificationsClick={() => {}}
      onQuickActionClick={() => {}}
      searchValue=""
    >
      <OrderDetailView onUpdateOrder={updateOrder} order={order} />
    </AppShell>
  );
}
