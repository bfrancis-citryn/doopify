"use client";

import { useEffect, useState } from 'react';
import AppShell from '../AppShell';
import { useOrders } from '../../context/OrdersContext';
import OrderDetailView from './OrderDetailView';

export default function OrderDetailClientPage({ orderNumber }) {
  const { orders } = useOrders();
  const normalizedOrderNumber = `#${String(orderNumber).replace(/^#/, '')}`;
  // Fallback to context order if fetch hasn't completed
  const summaryOrder = orders.find(entry => entry.orderNumber === normalizedOrderNumber);
  
  const [detailedOrder, setDetailedOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDetailedOrder = async () => {
    try {
      const num = String(orderNumber).replace(/^#/, '');
      const res = await fetch(`/api/orders/${num}`);
      const json = await res.json();
      if (json.success) {
        // We set the raw order to extract payments, refunds, returns.
        setDetailedOrder(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch detailed order', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetailedOrder();
  }, [orderNumber]);

  const handleUpdateOrder = (orderId, updater) => {
    updateOrder(orderId, updater);
  };

  // Combine the transformed UI order with the raw detailed payload
  const combinedOrder = summaryOrder ? {
    ...summaryOrder,
    payments: detailedOrder?.payments || [],
    refunds: detailedOrder?.refunds || [],
    returns: detailedOrder?.returns || [],
    rawItems: detailedOrder?.items || [],
  } : null;
  
  return (
    <AppShell
      onCreateOrder={() => {}}
      onNotificationsClick={() => {}}
      onQuickActionClick={() => {}}
      searchValue=""
    >
      <OrderDetailView 
        onUpdateOrder={handleUpdateOrder} 
        order={combinedOrder} 
        onRefetch={fetchDetailedOrder}
      />
    </AppShell>
  );
}
