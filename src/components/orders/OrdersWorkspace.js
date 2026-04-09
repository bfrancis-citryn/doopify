"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import { useOrders } from '../../context/OrdersContext';
import {
  ORDER_DELIVERY_STATUSES,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_PAYMENT_STATUSES,
  ORDER_VIEWS,
  formatOrderMoney,
  getOrderViewMatch,
  searchOrder,
  summarizeOrders,
} from '../../lib/ordersData';
import styles from './OrdersWorkspace.module.css';

function StatusPill({ children, tone }) {
  return <span className={`${styles.statusPill} ${styles[`tone_${tone}`]}`}>{children}</span>;
}

function BulkActionsBar({ selectedCount, onAction }) {
  if (!selectedCount) {
    return null;
  }

  return (
    <div className={styles.bulkBar}>
      <span>{selectedCount} selected</span>
      <div className={styles.bulkActions}>
        <button className={styles.bulkActionButton} onClick={() => onAction('fulfilled')} type="button">Mark fulfilled</button>
        <button className={styles.bulkActionButton} onClick={() => onAction('packed')} type="button">Mark packed</button>
        <button className={styles.bulkActionButton} onClick={() => onAction('tag-priority')} type="button">Add priority tag</button>
        <button className={styles.bulkActionButton} onClick={() => onAction('archive')} type="button">Archive</button>
      </div>
    </div>
  );
}

export default function OrdersWorkspace() {
  const { orders, setOrders } = useOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');

  const visibleOrders = useMemo(
    () =>
      orders.filter(order => {
        const baseMatch = getOrderViewMatch(order, activeView) && searchOrder(order, searchQuery);
        const paymentMatch = paymentFilter === 'all' || order.paymentStatus === paymentFilter;
        const fulfillmentMatch = fulfillmentFilter === 'all' || order.fulfillmentStatus === fulfillmentFilter;
        const deliveryMatch = deliveryFilter === 'all' || order.deliveryStatus === deliveryFilter;
        return baseMatch && paymentMatch && fulfillmentMatch && deliveryMatch;
      }),
    [activeView, deliveryFilter, fulfillmentFilter, orders, paymentFilter, searchQuery]
  );

  const summary = summarizeOrders(visibleOrders);

  const handleBulkAction = action => {
    setOrders(currentOrders =>
      currentOrders.map(order => {
        if (!selectedIds.includes(order.id)) {
          return order;
        }

        if (action === 'fulfilled') {
          return {
            ...order,
            fulfillmentStatus: 'fulfilled',
            deliveryStatus: order.deliveryStatus === 'not-shipped' ? 'in-transit' : order.deliveryStatus,
          };
        }

        if (action === 'packed') {
          return {
            ...order,
            fulfillmentStatus: 'packed',
          };
        }

        if (action === 'tag-priority') {
          return {
            ...order,
            tags: [...new Set([...(order.tags || []), 'Priority'])],
          };
        }

        if (action === 'archive') {
          return {
            ...order,
            tags: [...new Set([...(order.tags || []), 'Archived'])],
          };
        }

        return order;
      })
    );
    setSelectedIds([]);
  };

  const toggleSelectedRow = orderId => {
    setSelectedIds(current => (current.includes(orderId) ? current.filter(id => id !== orderId) : [...current, orderId]));
  };

  const toggleSelectAllVisible = checked => {
    setSelectedIds(checked ? visibleOrders.map(order => order.id) : []);
  };

  return (
    <AppShell
      onCreateOrder={() => {}}
      onNotificationsClick={() => {}}
      onQuickActionClick={() => {}}
      onSearchChange={event => setSearchQuery(event.target.value)}
      searchValue={searchQuery}
    >
      <div className={styles.ordersPage}>
        <div className={styles.ordersPageHeader}>
          <div className={styles.ordersPageHeading}>
            <span className={styles.ordersEyebrow}>Orders</span>
            <h1>Order management</h1>
            <p>Track fulfillment, payment status, returns, and customer activity without the clutter.</p>
          </div>
          <div className={styles.ordersPageActions}>
            <button className={styles.secondaryAction} type="button">Export</button>
            <button className={styles.primaryAction} type="button">Create order</button>
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}><span>Orders</span><strong>{summary.orders}</strong></div>
          <div className={styles.summaryCard}><span>Items ordered</span><strong>{summary.itemsOrdered}</strong></div>
          <div className={styles.summaryCard}><span>Returns</span><strong>{summary.returns}</strong></div>
          <div className={styles.summaryCard}><span>Orders fulfilled</span><strong>{summary.fulfilled}</strong></div>
          <div className={styles.summaryCard}><span>Orders delivered</span><strong>{summary.delivered}</strong></div>
          <div className={styles.summaryCard}><span>To fulfillment</span><strong>{summary.toFulfill}</strong></div>
        </div>

        <div className={styles.viewBar}>
          {ORDER_VIEWS.map(view => (
            <button key={view.id} className={activeView === view.id ? styles.viewButtonActive : styles.viewButton} onClick={() => setActiveView(view.id)} type="button">
              {view.label}
            </button>
          ))}
        </div>

        <div className={styles.filterToolbar}>
          <div className={styles.filterToolbarInner}>
            <select className={styles.filterSelect} onChange={event => setPaymentFilter(event.target.value)} value={paymentFilter}>
              <option value="all">All payments</option>
              {ORDER_PAYMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <select className={styles.filterSelect} onChange={event => setFulfillmentFilter(event.target.value)} value={fulfillmentFilter}>
              <option value="all">All fulfillment</option>
              {ORDER_FULFILLMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <select className={styles.filterSelect} onChange={event => setDeliveryFilter(event.target.value)} value={deliveryFilter}>
              <option value="all">All delivery</option>
              {ORDER_DELIVERY_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <button className={styles.textActionButton} type="button">Reset filters</button>
        </div>

        <BulkActionsBar onAction={handleBulkAction} selectedCount={selectedIds.length} />

        <div className={styles.ordersIndexWrap}>
          <div className={styles.ordersTableWrap}>
            <div className={styles.ordersTableTopbar}>
              <div>
                <h2>All orders</h2>
                <p>{visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'} matching your current view</p>
              </div>
              <div className={styles.ordersPageActions}>
                <button className={styles.secondaryAction} type="button">Saved views</button>
                <button className={styles.secondaryAction} type="button">Columns</button>
              </div>
            </div>

            <div className={styles.tableHeader}>
              <span><input checked={visibleOrders.length > 0 && selectedIds.length === visibleOrders.length} onChange={event => toggleSelectAllVisible(event.target.checked)} type="checkbox" /></span>
              <span>Order</span>
              <span>Date</span>
              <span>Customer</span>
              <span>Payment</span>
              <span>Fulfillment</span>
              <span>Delivery</span>
              <span>Total</span>
            </div>

            <div className={styles.tableBody}>
              {visibleOrders.length ? visibleOrders.map(order => (
                <div key={order.id} className={styles.orderRow}>
                  <div className={styles.checkboxCell}>
                    <input checked={selectedIds.includes(order.id)} onChange={() => toggleSelectedRow(order.id)} type="checkbox" />
                  </div>
                  <Link className={styles.rowButton} href={`/orders/${encodeURIComponent(order.orderNumber.replace('#', ''))}`}>
                    <div className={styles.orderNumberCell}>
                      <div className={styles.orderNumberPrimary}>
                        <strong>{order.orderNumber}</strong>
                        <span className={styles.orderChannelBadge}>{order.channel}</span>
                      </div>
                      <small>{order.itemCount} item{order.itemCount === 1 ? '' : 's'}</small>
                    </div>
                    <div className={styles.orderStat}>
                      <strong>{new Date(order.createdAt).toLocaleDateString()}</strong>
                      <small className={styles.orderStatMeta}>{new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
                    </div>
                    <div className={styles.customerCell}>
                      <strong>{order.customer.name}</strong>
                      <small>{order.customer.email}</small>
                    </div>
                    <div><StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill></div>
                    <div><StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill></div>
                    <div><StatusPill tone={order.deliveryStatus.replace(/\s+/g, '-')}>{order.deliveryStatus}</StatusPill></div>
                    <div className={styles.orderStat}>
                      <strong>{formatOrderMoney(order.total)}</strong>
                      <small className={styles.orderStatMeta}>{order.tags?.[0] || '—'}</small>
                    </div>
                  </Link>
                </div>
              )) : (
                <div className={styles.emptyState}>
                  <h2>No orders match these filters</h2>
                  <p>Try a different view or reset your filters to bring the orders back.</p>
                  <button className={styles.secondaryAction} onClick={() => {
                    setActiveView('all');
                    setPaymentFilter('all');
                    setFulfillmentFilter('all');
                    setDeliveryFilter('all');
                    setSearchQuery('');
                    setSelectedIds([]);
                  }} type="button">Reset everything</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
