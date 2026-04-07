"use client";

import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import { ORDER_VIEWS, createSeedOrders, formatOrderMoney, getOrderViewMatch, searchOrder, summarizeOrders } from '../../lib/ordersData';
import styles from './OrdersWorkspace.module.css';

function StatusPill({ children, tone }) {
  return <span className={`${styles.statusPill} ${styles[`tone_${tone}`]}`}>{children}</span>;
}

export default function OrdersWorkspace() {
  const [orders] = useState(createSeedOrders());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || null);

  const visibleOrders = useMemo(
    () => orders.filter(order => getOrderViewMatch(order, activeView) && searchOrder(order, searchQuery)),
    [activeView, orders, searchQuery]
  );

  const selectedOrder = visibleOrders.find(order => order.id === selectedOrderId) || orders.find(order => order.id === selectedOrderId) || visibleOrders[0] || null;
  const summary = summarizeOrders(visibleOrders);

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

        <div className={styles.ordersLayout}>
          <div className={styles.ordersTableWrap}>
            <div className={styles.tableHeader}>
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
                <button key={order.id} className={selectedOrder?.id === order.id ? styles.orderRowActive : styles.orderRow} onClick={() => setSelectedOrderId(order.id)} type="button">
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
                    <button className={styles.secondaryAction} type="button">Mark fulfilled</button>
                    <button className={styles.primaryAction} type="button">Add tracking</button>
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
                    <StatusPill tone={selectedOrder.paymentStatus.replace(/\s+/g, '-')}>{selectedOrder.paymentStatus}</StatusPill>
                  </div>
                  <div className={styles.detailSection}>
                    <h3>Fulfillment</h3>
                    <StatusPill tone={selectedOrder.fulfillmentStatus.replace(/\s+/g, '-')}>{selectedOrder.fulfillmentStatus}</StatusPill>
                  </div>
                  <div className={styles.detailSection}>
                    <h3>Delivery</h3>
                    <StatusPill tone={selectedOrder.deliveryStatus.replace(/\s+/g, '-')}>{selectedOrder.deliveryStatus}</StatusPill>
                  </div>
                  <div className={styles.detailSection}>
                    <h3>Shipping method</h3>
                    <p>{selectedOrder.deliveryMethod}</p>
                    <small>{selectedOrder.carrier} · {selectedOrder.trackingNumber || 'No tracking yet'}</small>
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
                    <p>{selectedOrder.notes}</p>
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
