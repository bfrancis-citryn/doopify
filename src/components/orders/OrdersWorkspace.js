"use client";

import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import {
  ORDER_DELIVERY_STATUSES,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_PAYMENT_STATUSES,
  ORDER_VIEWS,
  createSeedOrders,
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
  const [orders, setOrders] = useState(createSeedOrders());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || null);
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

  const selectedOrder =
    visibleOrders.find(order => order.id === selectedOrderId) ||
    orders.find(order => order.id === selectedOrderId) ||
    visibleOrders[0] ||
    null;
  const summary = summarizeOrders(visibleOrders);

  const updateOrder = (orderId, updater) => {
    setOrders(currentOrders => currentOrders.map(order => (order.id === orderId ? updater(order) : order)));
  };

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

        <BulkActionsBar onAction={handleBulkAction} selectedCount={selectedIds.length} />

        <div className={styles.ordersLayout}>
          <div className={styles.ordersTableWrap}>
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
              {visibleOrders.map(order => (
                <div key={order.id} className={selectedOrder?.id === order.id ? styles.orderRowActive : styles.orderRow}>
                  <div className={styles.checkboxCell}>
                    <input checked={selectedIds.includes(order.id)} onChange={() => toggleSelectedRow(order.id)} type="checkbox" />
                  </div>
                  <button className={styles.rowButton} onClick={() => setSelectedOrderId(order.id)} type="button">
                    <div className={styles.orderNumberCell}>
                      <strong>{order.orderNumber}</strong>
                      <small>{order.channel}</small>
                    </div>
                    <div>{new Date(order.createdAt).toLocaleDateString()}</div>
                    <div className={styles.customerCell}>
                      <strong>{order.customer.name}</strong>
                      <small>{order.customer.email}</small>
                    </div>
                    <div><StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill></div>
                    <div><StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill></div>
                    <div><StatusPill tone={order.deliveryStatus.replace(/\s+/g, '-')}>{order.deliveryStatus}</StatusPill></div>
                    <div>{formatOrderMoney(order.total)}</div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.orderDetailPane}>
            {selectedOrder ? (
              <div className={styles.detailCard}>
                <div className={styles.detailHeader}>
                  <div>
                    <p className={styles.detailEyebrow}>Order details</p>
                    <h2 className={styles.detailTitle}>{selectedOrder.orderNumber}</h2>
                  </div>
                  <div className={styles.detailActions}>
                    <button className={styles.secondaryAction} onClick={() => updateOrder(selectedOrder.id, order => ({ ...order, fulfillmentStatus: 'fulfilled', deliveryStatus: order.deliveryStatus === 'not-shipped' ? 'in-transit' : order.deliveryStatus }))} type="button">Mark fulfilled</button>
                    <button className={styles.primaryAction} onClick={() => updateOrder(selectedOrder.id, order => ({ ...order, trackingNumber: order.trackingNumber || `TRACK-${order.orderNumber.replace('#', '')}`, deliveryStatus: order.deliveryStatus === 'not-shipped' ? 'in-transit' : order.deliveryStatus }))} type="button">Add tracking</button>
                  </div>
                </div>

                <div className={styles.detailSection}>
                  <h3>Customer</h3>
                  <p>{selectedOrder.customer.name}</p>
                  <p>{selectedOrder.customer.email}</p>
                </div>

                <div className={styles.detailGrid}>
                  <div className={styles.detailSection}>
                    <h3>Payment</h3>
                    <select className={styles.detailSelect} onChange={event => updateOrder(selectedOrder.id, order => ({ ...order, paymentStatus: event.target.value }))} value={selectedOrder.paymentStatus}>
                      {ORDER_PAYMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                  <div className={styles.detailSection}>
                    <h3>Fulfillment</h3>
                    <select className={styles.detailSelect} onChange={event => updateOrder(selectedOrder.id, order => ({ ...order, fulfillmentStatus: event.target.value }))} value={selectedOrder.fulfillmentStatus}>
                      {ORDER_FULFILLMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                  <div className={styles.detailSection}>
                    <h3>Delivery</h3>
                    <select className={styles.detailSelect} onChange={event => updateOrder(selectedOrder.id, order => ({ ...order, deliveryStatus: event.target.value }))} value={selectedOrder.deliveryStatus}>
                      {ORDER_DELIVERY_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                  <div className={styles.detailSection}>
                    <h3>Shipping method</h3>
                    <input className={styles.detailInput} onChange={event => updateOrder(selectedOrder.id, order => ({ ...order, deliveryMethod: event.target.value }))} type="text" value={selectedOrder.deliveryMethod} />
                    <small>{selectedOrder.carrier} · {selectedOrder.trackingNumber || 'No tracking yet'}</small>
                  </div>
                </div>

                <div className={styles.detailGrid}>
                  <div className={styles.detailSection}>
                    <h3>Carrier</h3>
                    <input className={styles.detailInput} onChange={event => updateOrder(selectedOrder.id, order => ({ ...order, carrier: event.target.value }))} type="text" value={selectedOrder.carrier} />
                  </div>
                  <div className={styles.detailSection}>
                    <h3>Tracking number</h3>
                    <input className={styles.detailInput} onChange={event => updateOrder(selectedOrder.id, order => ({ ...order, trackingNumber: event.target.value }))} type="text" value={selectedOrder.trackingNumber} />
                  </div>
                </div>

                <div className={styles.detailSection}>
                  <h3>Line items</h3>
                  <div className={styles.lineItemList}>
                    {selectedOrder.lineItems.map(item => (
                      <div key={item.id} className={styles.lineItemRow}>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.variant}</small>
                        </div>
                        <div>{item.quantity} × {formatOrderMoney(item.price)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.detailGrid}>
                  <div className={styles.detailSection}>
                    <h3>Shipping address</h3>
                    <p>{selectedOrder.shippingAddress}</p>
                    <small>{selectedOrder.location}</small>
                  </div>
                  <div className={styles.detailSection}>
                    <h3>Notes</h3>
                    <textarea className={styles.notesInput} onChange={event => updateOrder(selectedOrder.id, order => ({ ...order, notes: event.target.value }))} rows={5} value={selectedOrder.notes} />
                    <small>Tags: {selectedOrder.tags.join(', ') || 'None'}</small>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
