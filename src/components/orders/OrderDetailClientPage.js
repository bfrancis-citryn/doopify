"use client";

import { useEffect, useState } from 'react';
import AppShell from '../AppShell';
import OrderDetailView from './OrderDetailView';

export default function OrderDetailClientPage({ orderNumber }) {
  const normalizedOrderNumber = String(orderNumber).replace(/^#/, '');
  const [detailedOrder, setDetailedOrder] = useState(null);

  const fetchDetailedOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${normalizedOrderNumber}/detail`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setDetailedOrder(json.data);
      } else {
        setDetailedOrder(null);
      }
    } catch (e) {
      console.error('Failed to fetch detailed order', e);
    }
  };

  useEffect(() => {
    fetchDetailedOrder();
  }, [normalizedOrderNumber]);

  const handleUpdateOrder = (_orderId, updater) => {
    setDetailedOrder((current) => (current ? updater(current) : current));
  };
  
  return (
    <AppShell
      onCreateOrder={() => {}}
      onNotificationsClick={() => {}}
      onQuickActionClick={() => {}}
      searchValue=""
    >
      <OrderDetailView 
        onUpdateOrder={handleUpdateOrder} 
        order={detailedOrder}
      />
    </AppShell>
  );
}
