"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../AppShell';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminEmptyState from '../admin/ui/AdminEmptyState';
import AdminInput from '../admin/ui/AdminInput';
import AdminLiveStatus from '../admin/ui/AdminLiveStatus';
import AdminPage from '../admin/ui/AdminPage';
import AdminPageHeader from '../admin/ui/AdminPageHeader';
import AdminSelect from '../admin/ui/AdminSelect';
import AdminStatCard, { AdminStatsGrid } from '../admin/ui/AdminStatCard';
import AdminStatusChip from '../admin/ui/AdminStatusChip';
import AdminTable from '../admin/ui/AdminTable';
import AdminToolbar from '../admin/ui/AdminToolbar';
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

  if (['paid', 'fulfilled', 'delivered'].includes(normalized)) return 'success';
  if (['failed', 'returned', 'refunded'].includes(normalized)) return 'danger';
  if (['pending', 'scheduled', 'packed', 'in-transit', 'out-for-delivery', 'ready-for-pickup', 'partially refunded', 'partially fulfilled'].includes(normalized)) {
    return 'warning';
  }

  return 'neutral';
}

function formatDashboardDate(value) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDashboardTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const selectOptions = (label, values) => [
  { value: 'all', label },
  ...values.map((value) => ({ value, label: value })),
];

export default function OrdersWorkspace() {
  const router = useRouter();
  const { orders, setOrders, loading, error } = useOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');

  const visibleOrders = useMemo(
    () =>
      orders.filter((order) => {
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
    () => visibleOrders.filter((order) => ['pending', 'failed'].includes(order.paymentStatus)).length,
    [visibleOrders]
  );

  const inTransitCount = useMemo(
    () => visibleOrders.filter((order) => ['in-transit', 'out-for-delivery'].includes(order.deliveryStatus)).length,
    [visibleOrders]
  );

  const handleBulkAction = (action) => {
    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (!selectedIds.includes(order.id)) return order;

        if (action === 'fulfilled') {
          return {
            ...order,
            fulfillmentStatus: 'fulfilled',
            deliveryStatus: order.deliveryStatus === 'not-shipped' ? 'in-transit' : order.deliveryStatus,
          };
        }

        if (action === 'packed') return { ...order, fulfillmentStatus: 'packed' };
        if (action === 'tag-priority') return { ...order, tags: [...new Set([...(order.tags || []), 'Priority'])] };
        if (action === 'archive') return { ...order, tags: [...new Set([...(order.tags || []), 'Archived'])] };

        return order;
      })
    );
    setSelectedIds([]);
  };

  const resetFilters = () => {
    setActiveView('all');
    setPaymentFilter('all');
    setFulfillmentFilter('all');
    setDeliveryFilter('all');
    setSearchQuery('');
    setSelectedIds([]);
  };

  const allVisibleSelected = visibleOrders.length > 0 && selectedIds.length === visibleOrders.length;

  const columns = [
    {
      key: 'selected',
      header: (
        <input
          checked={allVisibleSelected}
          onChange={(event) => setSelectedIds(event.target.checked ? visibleOrders.map((order) => order.id) : [])}
          type="checkbox"
        />
      ),
      render: (order) => (
        <input
          checked={selectedIds.includes(order.id)}
          onChange={() =>
            setSelectedIds((current) =>
              current.includes(order.id) ? current.filter((id) => id !== order.id) : [...current, order.id]
            )
          }
          onClick={(event) => event.stopPropagation()}
          type="checkbox"
        />
      ),
    },
    {
      key: 'order',
      header: 'Order',
      render: (order) => (
        <div className={styles.orderCell}>
          <div className={styles.orderCellTop}>
            <strong>{order.orderNumber}</strong>
            <AdminStatusChip tone="neutral">{order.channel}</AdminStatusChip>
          </div>
          <small>
            {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
            {order.tags?.[0] ? ` | ${order.tags[0]}` : ''}
          </small>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (order) => (
        <div className={styles.customerCell}>
          <strong>{order.customer.name}</strong>
          <small>{order.customer.email}</small>
        </div>
      ),
    },
    {
      key: 'placed',
      header: 'Placed',
      render: (order) => (
        <div className={styles.statCell}>
          <strong>{formatDashboardDate(order.createdAt)}</strong>
          <small>{formatDashboardTime(order.createdAt)}</small>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => (
        <div className={styles.statusCell}>
          <AdminStatusChip tone={getStatusTone(order.fulfillmentStatus)}>{order.fulfillmentStatus}</AdminStatusChip>
          <AdminStatusChip tone={getStatusTone(order.deliveryStatus)}>{order.deliveryStatus}</AdminStatusChip>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (order) => (
        <div className={styles.statCell}>
          <strong>{formatOrderMoney(order.total)}</strong>
          <small>{order.paymentStatus}</small>
        </div>
      ),
    },
  ];

  return (
    <AppShell onSearchChange={() => {}} searchValue={searchQuery}>
      <AdminPage>
        {error ? <p className={styles.notice}>Unable to sync orders right now. Showing the latest loaded data.</p> : null}

        <AdminPageHeader
          actions={<AdminLiveStatus label="Live" />}
          description="Server-owned order flow with fulfillment and payment visibility."
          eyebrow="Orders"
          title="Order desk"
        />

        <AdminStatsGrid>
          <AdminStatCard label="Total sales" meta={`${summary.orders} orders in view`} value={formatOrderMoney(grossSales)} />
          <AdminStatCard label="Active orders" meta={`${summary.fulfilled} fulfilled so far`} value={String(summary.orders)} />
          <AdminStatCard label="Pending ship" meta={`${inTransitCount} already in transit`} value={String(summary.toFulfill)} />
          <AdminStatCard label="Pending payment" meta={`${summary.returns} returns active`} value={String(pendingPayments)} />
        </AdminStatsGrid>

        <AdminCard className={styles.tablePanel} variant="panel">
          <AdminToolbar
            actions={(
              <>
                <AdminButton onClick={resetFilters} size="sm" variant="ghost">Reset</AdminButton>
                <AdminButton size="sm" variant="secondary">Saved views</AdminButton>
                <AdminButton size="sm" variant="secondary">Columns</AdminButton>
              </>
            )}
          >
            <AdminInput
              className={styles.searchInput}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search orders, customers, channels..."
              type="search"
              value={searchQuery}
            />
            <AdminSelect onChange={setPaymentFilter} options={selectOptions('All payments', ORDER_PAYMENT_STATUSES)} value={paymentFilter} />
            <AdminSelect onChange={setFulfillmentFilter} options={selectOptions('All fulfillment', ORDER_FULFILLMENT_STATUSES)} value={fulfillmentFilter} />
            <AdminSelect onChange={setDeliveryFilter} options={selectOptions('All delivery', ORDER_DELIVERY_STATUSES)} value={deliveryFilter} />
          </AdminToolbar>

          <div className={styles.viewRow}>
            {ORDER_VIEWS.map((view) => (
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

          {selectedIds.length ? (
            <div className={styles.bulkBar}>
              <span>{selectedIds.length} selected</span>
              <div className={styles.bulkActions}>
                <AdminButton onClick={() => handleBulkAction('fulfilled')} size="sm" variant="secondary">Mark fulfilled</AdminButton>
                <AdminButton onClick={() => handleBulkAction('packed')} size="sm" variant="secondary">Mark packed</AdminButton>
                <AdminButton onClick={() => handleBulkAction('tag-priority')} size="sm" variant="secondary">Add priority tag</AdminButton>
                <AdminButton onClick={() => handleBulkAction('archive')} size="sm" variant="secondary">Archive</AdminButton>
              </div>
            </div>
          ) : null}

          {loading ? (
            <AdminTable columns={columns} isLoading rows={[]} />
          ) : visibleOrders.length ? (
            <AdminTable
              columns={columns}
              onRowClick={(order) => router.push(`/orders/${encodeURIComponent(order.orderNumber.replace('#', ''))}`)}
              rows={visibleOrders}
            />
          ) : (
            <AdminEmptyState
              actionLabel="Reset filters"
              description="Try a broader view or reset filters to repopulate the order stream."
              onAction={resetFilters}
              title="No orders match these filters"
            />
          )}
        </AdminCard>
      </AdminPage>
    </AppShell>
  );
}