"use client";

import { createContext, useContext, useMemo, useState } from 'react';
import { createSeedOrders } from '../lib/ordersData';

const OrdersContext = createContext(null);

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState(createSeedOrders());

  const addOrder = order => {
    setOrders(current => [order, ...current]);
  };

  const updateOrder = (orderId, updater) => {
    setOrders(current => current.map(order => (order.id === orderId ? updater(order) : order)));
  };

  const value = useMemo(
    () => ({
      orders,
      setOrders,
      addOrder,
      updateOrder,
    }),
    [orders]
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error('useOrders must be used within OrdersProvider');
  }

  return context;
}
