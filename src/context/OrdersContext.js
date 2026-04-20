"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ORDER_DELIVERY_STATUSES,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_PAYMENT_STATUSES,
  ORDER_VIEWS,
  formatOrderMoney,
  getOrderViewMatch,
  searchOrder,
  summarizeOrders,
} from '../lib/ordersData';

const OrdersContext = createContext(null);

// ── Transform API order → UI shape ────────────────────────────────────────────
function transformOrder(order) {
  const shippingAddr = order.addresses?.find(a => a.type === 'SHIPPING');
  const addrString = shippingAddr
    ? [shippingAddr.address1, shippingAddr.city, shippingAddr.province].filter(Boolean).join(', ')
    : '';

  const customerName = order.customer
    ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') || order.customer.email
    : order.email || 'Guest';

  const payStatus = (order.paymentStatus || 'PENDING').toLowerCase().replace(/_/g, ' ');
  const fulStatus = (order.fulfillmentStatus || 'UNFULFILLED').toLowerCase().replace(/_/g, ' ');

  return {
    id: order.id,
    orderNumber: `#${order.orderNumber}`,
    createdAt: order.createdAt,
    customer: {
      name: customerName,
      email: order.customer?.email || order.email || '',
    },
    channel: order.channel || 'Online Store',
    total: order.total || 0,
    itemCount: order.items?.length || 0,
    paymentStatus: payStatus,
    fulfillmentStatus: fulStatus,
    deliveryStatus: order.fulfillments?.length > 0 ? 'in-transit' : 'not-shipped',
    returnStatus: order.returns?.length > 0 ? order.returns[0].status.toLowerCase() : 'none',
    deliveryMethod: order.shippingAmount > 0 ? 'Standard shipping' : 'Free shipping',
    tags: order.tags || [],
    riskLevel: 'low',
    trackingNumber: order.fulfillments?.[0]?.trackingNumber || '',
    carrier: order.fulfillments?.[0]?.carrier || '',
    location: '',
    shippingAddress: addrString,
    billingAddress: addrString,
    notes: order.note || '',
    timeline: (order.events || []).map(e => ({
      id: e.id,
      event: e.title,
      detail: e.detail || '',
      createdAt: e.createdAt,
    })),
    lineItems: (order.items || []).map(item => ({
      id: item.id,
      title: item.title,
      variant: item.variantTitle || '',
      quantity: item.quantity,
      price: item.price,
    })),
    subtotal: order.subtotal || 0,
    taxAmount: order.taxAmount || 0,
    shippingAmount: order.shippingAmount || 0,
    discountAmount: order.discountAmount || 0,
    currency: order.currency || 'USD',
    status: (order.status || 'OPEN').toLowerCase(),
  };
}

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/orders?pageSize=100');
      const json = await res.json();
      if (json.success) {
        setOrders((json.data.orders || []).map(transformOrder));
      } else {
        setError(json.error || 'Failed to load orders');
      }
    } catch (e) {
      setError('Failed to load orders');
      console.error('[OrdersContext]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const addOrder = useCallback(order => {
    setOrders(current => [order, ...current]);
  }, []);

  const updateOrder = useCallback((orderId, updater) => {
    setOrders(current => current.map(o => (o.id === orderId ? updater(o) : o)));
  }, []);

  const value = useMemo(
    () => ({ orders, setOrders, addOrder, updateOrder, loading, error, refetch: fetchOrders }),
    [orders, loading, error, addOrder, updateOrder, fetchOrders]
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error('useOrders must be used within OrdersProvider');
  return context;
}
