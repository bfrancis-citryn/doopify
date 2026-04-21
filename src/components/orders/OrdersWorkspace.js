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

function formatDashboardDate(value) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDashboardTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function OrdersWorkspace() {
  const { orders, setOrders, loading, error } = useOrders();
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

  const summary = useMemo(() => summarizeOrders(visibleOrders), [visibleOrders]);

  const grossSales = useMemo(
    () => visibleOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [visibleOrders]
  );

  const pendingPayments = useMemo(
    () => visibleOrders.filter(order => ['pending', 'failed'].includes(order.paymentStatus)).length,
    [visibleOrders]
  );

  const inTransitCount = useMemo(
    () => visibleOrders.filter(order => ['in-transit', 'out-for-delivery'].includes(order.deliveryStatus)).length,
    [visibleOrders]
  );

  const pickupCount = useMemo(
    () => visibleOrders.filter(order => order.deliveryMethod.toLowerCase().includes('pickup')).length,
    [visibleOrders]
  );

  const systemLog = useMemo(
    () =>
      visibleOrders
        .flatMap(order =>
          (order.timeline || []).map(entry => ({
            ...entry,
            orderNumber: order.orderNumber,
            customer: order.customer.name,
          }))
        )
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 5),
    [visibleOrders]
  );

  const focusQueue = useMemo(
    () =>
      visibleOrders
        .filter(
          order =>
            order.riskLevel !== 'low' ||
            order.tags?.includes('Priority') ||
            ['pending', 'failed'].includes(order.paymentStatus) ||
            order.deliveryStatus === 'returned'
        )
        .slice(0, 4),
    [visibleOrders]
  );

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

  const resetFilters = () => {
    setActiveView('all');
    setPaymentFilter('all');
    setFulfillmentFilter('all');
    setDeliveryFilter('all');
    setSearchQuery('');
    setSelectedIds([]);
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
            <span className={styles.ordersEyebrow}>Obsidian order desk</span>
            <h1>Order management</h1>
            <p>Real-time orchestration for fulfillment, payment review, delivery updates, and customer follow-through.</p>
          </div>

          <div className={styles.ordersPageActions}>
            <button className={styles.secondaryAction} type="button">Export</button>
            <button className={styles.primaryAction} type="button">Create order</button>
          </div>
        </div>

        {error ? <div className={styles.noticeBanner}>Unable to sync orders right now. Showing the latest loaded data.</div> : null}

        <div className={styles.heroGrid}>
          <section className={styles.ordersTableWrap}>
            <div className={styles.ordersTableTopbar}>
              <div>
                <div className={styles.tableHeadingRow}>
                  <h2>Recent orders</h2>
                  <span className={styles.liveBadge}>Live</span>
                </div>
                <p>{visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'} in the current operational view</p>
              </div>

              <div className={styles.ordersPageActions}>
                <button className={styles.secondaryAction} type="button">Saved views</button>
                <button className={styles.secondaryAction} type="button">Columns</button>
              </div>
            </div>

            <div className={styles.filterToolbar}>
              <div className={styles.viewBar}>
                {ORDER_VIEWS.map(view => (
                  <button
                    key={view.id}
                    className={activeView === view.id ? styles.viewButtonActive : styles.viewButton}
                    onClick={() => setActiveView(view.id)}
                    type="button"
                  >
                    {view.label}
                  </button>
                ))}
              </div>

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

                <button className={styles.textActionButton} onClick={resetFilters} type="button">Reset</button>
              </div>
            </div>

            <BulkActionsBar onAction={handleBulkAction} selectedCount={selectedIds.length} />

            <div className={styles.tableHeader}>
              <span>
                <input
                  checked={visibleOrders.length > 0 && selectedIds.length === visibleOrders.length}
                  onChange={event => toggleSelectAllVisible(event.target.checked)}
                  type="checkbox"
                />
              </span>
              <span>Order</span>
              <span>Customer</span>
              <span>Date</span>
              <span>Status</span>
              <span>Total</span>
            </div>

            <div className={`custom-scrollbar ${styles.tableBody}`}>
              {loading ? (
                <div className={styles.emptyState}>
                  <h2>Loading orders</h2>
                  <p>Pulling the latest order activity into the dashboard.</p>
                </div>
              ) : null}

              {!loading && visibleOrders.length ? visibleOrders.map(order => (
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
                      <small>{order.itemCount} item{order.itemCount === 1 ? '' : 's'}{order.tags?.[0] ? ` | ${order.tags[0]}` : ''}</small>
                    </div>

                    <div className={styles.customerCell}>
                      <strong>{order.customer.name}</strong>
                      <small>{order.customer.email}</small>
                    </div>

                    <div className={styles.orderStat}>
                      <strong>{formatDashboardDate(order.createdAt)}</strong>
                      <small className={styles.orderStatMeta}>{formatDashboardTime(order.createdAt)}</small>
                    </div>

                    <div className={styles.statusStack}>
                      <StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill>
                      <StatusPill tone={order.deliveryStatus.replace(/\s+/g, '-')}>{order.deliveryStatus}</StatusPill>
                    </div>

                    <div className={styles.orderStat}>
                      <strong>{formatOrderMoney(order.total)}</strong>
                      <small className={styles.orderStatMeta}>{order.paymentStatus}</small>
                    </div>
                  </Link>
                </div>
              )) : null}

              {!loading && !visibleOrders.length ? (
                <div className={styles.emptyState}>
                  <h2>No orders match these filters</h2>
                  <p>Try a broader view or reset the filters to repopulate the live order stream.</p>
                  <button className={styles.secondaryAction} onClick={resetFilters} type="button">Reset everything</button>
                </div>
              ) : null}
            </div>
          </section>

          <aside className={styles.sideRail}>
            <section className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <div>
                  <h2>Shipment pulse</h2>
                  <p>High level movement across the current queue.</p>
                </div>
              </div>

              <div className={styles.sideMetricList}>
                <div className={styles.sideMetricRow}><span>To fulfill</span><strong>{summary.toFulfill}</strong></div>
                <div className={styles.sideMetricRow}><span>In transit</span><strong>{inTransitCount}</strong></div>
                <div className={styles.sideMetricRow}><span>Delivered</span><strong>{summary.delivered}</strong></div>
                <div className={styles.sideMetricRow}><span>Local pickup</span><strong>{pickupCount}</strong></div>
              </div>
            </section>

            <section className={styles.sideCard}>
              <div className={styles.sideCardHeader}>
                <div>
                  <h2>Quick links</h2>
                  <p>Jump the desk to the queues that need attention.</p>
                </div>
              </div>

              <div className={styles.quickLinks}>
                <button className={styles.quickLinkButton} onClick={() => setActiveView('returns')} type="button">
                  <span>Return review</span>
                  <small>{summary.returns} active returns</small>
                </button>
                <button className={styles.quickLinkButton} onClick={() => setActiveView('unpaid')} type="button">
                  <span>Payment follow-up</span>
                  <small>{pendingPayments} awaiting capture</small>
                </button>
                <button className={styles.quickLinkButton} onClick={() => setActiveView('local-pickup')} type="button">
                  <span>Pickup desk</span>
                  <small>{pickupCount} local pickup orders</small>
                </button>
              </div>
            </section>
          </aside>
        </div>

        <div className={styles.lowerGrid}>
          <section className={styles.logCard}>
            <div className={styles.sectionCardHeader}>
              <div>
                <h3>System log</h3>
                <p className={styles.cardSubtext}>Recent timeline events pulled from active orders.</p>
              </div>
            </div>

            <div className={styles.logList}>
              {systemLog.length ? systemLog.map(entry => (
                <div key={`${entry.orderNumber}-${entry.id}`} className={styles.logRow}>
                  <div className={styles.logDot} />
                  <div className={styles.logContent}>
                    <strong>{entry.event}</strong>
                    <p>{entry.orderNumber} | {entry.customer}</p>
                  </div>
                  <small>{formatDashboardDate(entry.createdAt)}</small>
                </div>
              )) : (
                <div className={styles.emptyMiniState}>No recent activity yet.</div>
              )}
            </div>
          </section>

          <section className={styles.queueCard}>
            <div className={styles.sectionCardHeader}>
              <div>
                <h3>Focus queue</h3>
                <p className={styles.cardSubtext}>Orders with risk, priority, or return activity.</p>
              </div>
            </div>

            <div className={styles.queueList}>
              {focusQueue.length ? focusQueue.map(order => (
                <Link
                  key={order.id}
                  className={styles.queueRow}
                  href={`/orders/${encodeURIComponent(order.orderNumber.replace('#', ''))}`}
                >
                  <div>
                    <strong>{order.orderNumber}</strong>
                    <p>{order.customer.name}</p>
                  </div>
                  <StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill>
                </Link>
              )) : (
                <div className={styles.emptyMiniState}>Nothing needs special attention right now.</div>
              )}
            </div>
          </section>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span>Total sales</span>
            <strong>{formatOrderMoney(grossSales)}</strong>
            <small>{summary.orders} orders in view</small>
          </div>

          <div className={styles.summaryCard}>
            <span>Active orders</span>
            <strong>{summary.orders}</strong>
            <small>{summary.fulfilled} fulfilled so far</small>
          </div>

          <div className={styles.summaryCard}>
            <span>Pending ship</span>
            <strong>{summary.toFulfill}</strong>
            <small>{inTransitCount} already in transit</small>
          </div>

          <div className={styles.summaryCard}>
            <span>Pending payment</span>
            <strong>{pendingPayments}</strong>
            <small>{summary.returns} returns currently active</small>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
