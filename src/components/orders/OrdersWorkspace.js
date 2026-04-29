"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminLiveStatus from '../admin/ui/AdminLiveStatus';
import AdminSkeleton from '../admin/ui/AdminSkeleton';
import AdminStatusChip from '../admin/ui/AdminStatusChip';
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

function getStatusTone(status) {
  const normalized = String(status || '').toLowerCase();

  if (['paid', 'fulfilled', 'delivered'].includes(normalized)) {
    return 'success';
  }

  if (['failed', 'returned', 'refunded'].includes(normalized)) {
    return 'danger';
  }

  if (
    [
      'pending',
      'scheduled',
      'packed',
      'in-transit',
      'out-for-delivery',
      'ready-for-pickup',
      'partially refunded',
      'partially fulfilled',
    ].includes(normalized)
  ) {
    return 'warning';
  }

  return 'neutral';
}

function BulkActionsBar({ selectedCount, onAction }) {
  if (!selectedCount) {
    return null;
  }

  return (
    <div className={styles.bulkBarV7}>
      <span>{selectedCount} selected</span>
      <div className={styles.bulkActionsV7}>
        <AdminButton onClick={() => onAction('fulfilled')} size="sm" variant="secondary">Mark fulfilled</AdminButton>
        <AdminButton onClick={() => onAction('packed')} size="sm" variant="secondary">Mark packed</AdminButton>
        <AdminButton onClick={() => onAction('tag-priority')} size="sm" variant="secondary">Add priority tag</AdminButton>
        <AdminButton onClick={() => onAction('archive')} size="sm" variant="secondary">Archive</AdminButton>
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
      onSearchChange={() => {}}
      searchValue={searchQuery}
    >
      <div className={styles.ordersPageV7}>
        {error ? <div className={styles.noticeBanner}>Unable to sync orders right now. Showing the latest loaded data.</div> : null}

        <div className={styles.summaryGridV7}>
          <AdminCard className={styles.statCardV7} variant="card">
            <span className={styles.statLabelV7}>Total sales</span>
            <strong className={styles.statValueV7}>{formatOrderMoney(grossSales)}</strong>
            <small className={styles.statMetaV7}>{summary.orders} orders in view</small>
          </AdminCard>

          <AdminCard className={styles.statCardV7} variant="card">
            <span className={styles.statLabelV7}>Active orders</span>
            <strong className={styles.statValueV7}>{summary.orders}</strong>
            <small className={styles.statMetaV7}>{summary.fulfilled} fulfilled so far</small>
          </AdminCard>

          <AdminCard className={styles.statCardV7} variant="card">
            <span className={styles.statLabelV7}>Pending ship</span>
            <strong className={styles.statValueV7}>{summary.toFulfill}</strong>
            <small className={styles.statMetaV7}>{inTransitCount} already in transit</small>
          </AdminCard>

          <AdminCard className={styles.statCardV7} variant="card">
            <span className={styles.statLabelV7}>Pending payment</span>
            <strong className={styles.statValueV7}>{pendingPayments}</strong>
            <small className={styles.statMetaV7}>{summary.returns} returns currently active</small>
          </AdminCard>
        </div>

        <div className={styles.ordersLayoutV7}>
          <AdminCard className={styles.ordersTablePanelV7} spotlight variant="panel">
            <div className={styles.ordersTableTopbarV7}>
              <div>
                <div className={styles.tableHeadingRowV7}>
                  <h2>Recent orders</h2>
                  <AdminLiveStatus label="Live" />
                </div>
                <p className={styles.panelSubcopyV7}>{visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'} in the current operational view</p>
              </div>

              <div className={styles.topActionsV7}>
                <AdminButton size="sm" variant="secondary">Saved views</AdminButton>
                <AdminButton size="sm" variant="secondary">Columns</AdminButton>
              </div>
            </div>

            <div className={styles.filterToolbarV7}>
              <div className={styles.viewBarV7}>
                {ORDER_VIEWS.map(view => (
                  <AdminButton
                    key={view.id}
                    onClick={() => setActiveView(view.id)}
                    size="sm"
                    variant={activeView === view.id ? 'primary' : 'secondary'}
                  >
                    {view.label}
                  </AdminButton>
                ))}
              </div>

              <div className={styles.filterToolbarInnerV7}>
                <input
                  className={styles.searchInputV7}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search orders, customers, channels..."
                  type="search"
                  value={searchQuery}
                />

                <select className={styles.filterSelectV7} onChange={event => setPaymentFilter(event.target.value)} value={paymentFilter}>
                  <option value="all">All payments</option>
                  {ORDER_PAYMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>

                <select className={styles.filterSelectV7} onChange={event => setFulfillmentFilter(event.target.value)} value={fulfillmentFilter}>
                  <option value="all">All fulfillment</option>
                  {ORDER_FULFILLMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>

                <select className={styles.filterSelectV7} onChange={event => setDeliveryFilter(event.target.value)} value={deliveryFilter}>
                  <option value="all">All delivery</option>
                  {ORDER_DELIVERY_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>

                <AdminButton onClick={resetFilters} size="sm" variant="ghost">Reset</AdminButton>
              </div>
            </div>

            <BulkActionsBar onAction={handleBulkAction} selectedCount={selectedIds.length} />

            <div className={styles.tableHeaderV7}>
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

            <div className={`custom-scrollbar ${styles.tableBodyV7}`}>
              {loading ? (
                <div className={styles.loadingBlockV7}>
                  <AdminSkeleton columns={6} rows={6} variant="table" />
                </div>
              ) : null}

              {!loading && visibleOrders.length ? visibleOrders.map(order => (
                <div key={order.id} className={styles.orderRowV7}>
                  <div className={styles.checkboxCellV7}>
                    <input checked={selectedIds.includes(order.id)} onChange={() => toggleSelectedRow(order.id)} type="checkbox" />
                  </div>

                  <Link className={styles.rowButtonV7} href={`/orders/${encodeURIComponent(order.orderNumber.replace('#', ''))}`}>
                    <div className={styles.orderNumberCellV7}>
                      <div className={styles.orderNumberPrimaryV7}>
                        <strong>{order.orderNumber}</strong>
                        <AdminStatusChip tone="neutral">{order.channel}</AdminStatusChip>
                      </div>
                      <small>{order.itemCount} item{order.itemCount === 1 ? '' : 's'}{order.tags?.[0] ? ` | ${order.tags[0]}` : ''}</small>
                    </div>

                    <div className={styles.customerCellV7}>
                      <strong>{order.customer.name}</strong>
                      <small>{order.customer.email}</small>
                    </div>

                    <div className={styles.orderStatV7}>
                      <strong>{formatDashboardDate(order.createdAt)}</strong>
                      <small className={styles.orderStatMetaV7}>{formatDashboardTime(order.createdAt)}</small>
                    </div>

                    <div className={styles.statusStackV7}>
                      <AdminStatusChip tone={getStatusTone(order.fulfillmentStatus)}>{order.fulfillmentStatus}</AdminStatusChip>
                      <AdminStatusChip tone={getStatusTone(order.deliveryStatus)}>{order.deliveryStatus}</AdminStatusChip>
                    </div>

                    <div className={styles.orderStatV7}>
                      <strong>{formatOrderMoney(order.total)}</strong>
                      <small className={styles.orderStatMetaV7}>{order.paymentStatus}</small>
                    </div>
                  </Link>
                </div>
              )) : null}

              {!loading && !visibleOrders.length ? (
                <div className={styles.emptyStateV7}>
                  <h2>No orders match these filters</h2>
                  <p>Try a broader view or reset the filters to repopulate the live order stream.</p>
                  <AdminButton onClick={resetFilters} size="sm" variant="secondary">Reset everything</AdminButton>
                </div>
              ) : null}
            </div>
          </AdminCard>

          <aside className={styles.sideRailV7}>
            <AdminCard className={styles.sideCardV7} variant="card">
              <div className={styles.sideCardHeaderV7}>
                <div>
                  <h2>Shipment pulse</h2>
                  <p className={styles.panelSubcopyV7}>High level movement across the current queue.</p>
                </div>
              </div>

              <div className={styles.sideMetricListV7}>
                <div className={styles.sideMetricRowV7}><span>To fulfill</span><strong>{summary.toFulfill}</strong></div>
                <div className={styles.sideMetricRowV7}><span>In transit</span><strong>{inTransitCount}</strong></div>
                <div className={styles.sideMetricRowV7}><span>Delivered</span><strong>{summary.delivered}</strong></div>
                <div className={styles.sideMetricRowV7}><span>Local pickup</span><strong>{pickupCount}</strong></div>
              </div>
            </AdminCard>

            <AdminCard className={styles.sideCardV7} variant="card">
              <div className={styles.sideCardHeaderV7}>
                <div>
                  <h2>Quick links</h2>
                  <p className={styles.panelSubcopyV7}>Jump the desk to the queues that need attention.</p>
                </div>
              </div>

              <div className={styles.quickLinksV7}>
                <AdminButton className={styles.quickLinkButtonV7} onClick={() => setActiveView('returns')} variant="secondary">
                  <span>Return review</span>
                  <small>{summary.returns} active returns</small>
                </AdminButton>
                <AdminButton className={styles.quickLinkButtonV7} onClick={() => setActiveView('unpaid')} variant="secondary">
                  <span>Payment follow-up</span>
                  <small>{pendingPayments} awaiting capture</small>
                </AdminButton>
                <AdminButton className={styles.quickLinkButtonV7} onClick={() => setActiveView('local-pickup')} variant="secondary">
                  <span>Pickup desk</span>
                  <small>{pickupCount} local pickup orders</small>
                </AdminButton>
              </div>
            </AdminCard>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
