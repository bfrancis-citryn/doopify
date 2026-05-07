"use client";

import { useEffect, useState } from 'react';
import AppShell from '../AppShell';
import OrderDetailView from './OrderDetailView';
import { useOrders } from '../../context/OrdersContext';

export default function OrderDetailClientPage({ orderNumber }) {
  const normalizedOrderNumber = String(orderNumber).replace(/^#/, '');
  const { refetch: refetchOrders } = useOrders();
  const [detailedOrder, setDetailedOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);

  const fetchDetailedOrder = async () => {
    setIsLoading(true);
    setIsNotFound(false);
    try {
      const res = await fetch(`/api/orders/${normalizedOrderNumber}/detail`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setDetailedOrder(json.data);
      } else if (res.status === 404) {
        setDetailedOrder(null);
        setIsNotFound(true);
      } else {
        setDetailedOrder(null);
      }
    } catch (e) {
      console.error('Failed to fetch detailed order', e);
    } finally {
      setIsLoading(false);
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
        isLoading={isLoading}
        isNotFound={isNotFound}
        onOrderRefreshed={refetchOrders}
      />
    </AppShell>
  );
}
