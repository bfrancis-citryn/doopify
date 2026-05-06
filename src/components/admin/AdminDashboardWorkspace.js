"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '../AppShell';
import AdminCard from '../admin/ui/AdminCard';
import AdminPage from '../admin/ui/AdminPage';
import AdminPageHeader from '../admin/ui/AdminPageHeader';
import AdminSkeleton from '../admin/ui/AdminSkeleton';
import AdminStatCard, { AdminStatsGrid } from '../admin/ui/AdminStatCard';
import AdminStatusChip from '../admin/ui/AdminStatusChip';
import { useCustomers } from '../../context/CustomersContext';
import { useOrders } from '../../context/OrdersContext';
import { useProducts } from '../../context/ProductsContext';
import { useSettings } from '../../context/SettingsContext';
import { buildDashboardFirstRunGuide } from './dashboard-first-run-guide.helpers';
import styles from './AdminDashboardWorkspace.module.css';

function formatCompactNumber(value) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatRelativeTime(dateValue) {
  const timestamp = new Date(dateValue).getTime();
  const diffMinutes = Math.round((timestamp - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, 'hour');
  return formatter.format(Math.round(diffHours / 24), 'day');
}

const FALLBACK_ACTIVITY = [
  {
    id: 'fallback-catalog',
    title: 'Catalog sync completed successfully.',
    detail: 'Product, inventory, and pricing data look healthy.',
    href: '/products',
    time: 'Ready',
    icon: 'inventory_2',
  },
  {
    id: 'fallback-orders',
    title: 'Order desk is ready for review.',
    detail: 'Open the live queue to manage fulfillment and payment follow-up.',
    href: '/orders',
    time: 'Ready',
    icon: 'shopping_bag',
  },
  {
    id: 'fallback-customers',
    title: 'Customer profiles are synced.',
    detail: 'Jump into CRM to inspect activity and lifetime value.',
    href: '/customers',
    time: 'Ready',
    icon: 'groups',
  },
];

export default function AdminDashboardWorkspace() {
  const { orders, loading: ordersLoading } = useOrders();
  const { products, loading: productsLoading } = useProducts();
  const { customers, loading: customersLoading } = useCustomers();
  const { settings } = useSettings();
  const [sessionUser, setSessionUser] = useState(null);
  const [setupWizard, setSetupWizard] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      try {
        const response = await fetch('/api/auth/me');
        const payload = await response.json().catch(() => null);

        if (!ignore && response.ok && payload?.success) {
          setSessionUser(payload.data);
        }
      } catch {}
    }

    loadSession();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadSetupWizard() {
      try {
        const response = await fetch('/api/setup/wizard', { cache: 'no-store' });
        if (!response.ok) return;

        const payload = await response.json().catch(() => null);
        if (!ignore && payload?.success) {
          setSetupWizard(payload.data || null);
        }
      } catch {}
    }

    loadSetupWizard();

    return () => {
      ignore = true;
    };
  }, []);

  const lowInventoryThreshold = Number(settings.lowInventoryAlert || 5);

  const overview = useMemo(() => {
    const grossSales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const averageOrderValue = orders.length ? grossSales / orders.length : 0;
    const activeProducts = products.filter((product) => product.status === 'active').length;
    const inventoryUnits = products.reduce(
      (sum, product) =>
        sum +
        product.variants.reduce((variantSum, variant) => variantSum + Number(variant.inventoryQty || 0), 0),
      0
    );
    const lowStockCount = products.filter((product) => {
      const inventory = product.variants.reduce((sum, variant) => sum + Number(variant.inventoryQty || 0), 0);
      return inventory <= lowInventoryThreshold;
    }).length;

    const activity = orders
      .flatMap((order) =>
        (order.timeline || []).map((entry) => ({
          id: `${order.id}-${entry.id}`,
          title: entry.event,
          detail: entry.detail || `${order.orderNumber} for ${order.customer.name}`,
          href: `/orders/${encodeURIComponent(order.orderNumber.replace('#', ''))}`,
          time: formatRelativeTime(entry.createdAt),
          timestamp: new Date(entry.createdAt).getTime(),
          icon:
            entry.event.toLowerCase().includes('payment')
              ? 'credit_card'
              : entry.event.toLowerCase().includes('fulfilled')
                ? 'local_shipping'
                : 'notifications_active',
        }))
      )
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 6);

    return {
      grossSales,
      averageOrderValue,
      activeProducts,
      inventoryUnits,
      lowStockCount,
      activity,
    };
  }, [lowInventoryThreshold, orders, products]);

  const recentActivity = overview.activity.length ? overview.activity : FALLBACK_ACTIVITY;
  const loading = ordersLoading || productsLoading || customersLoading;
  const firstRunGuide = useMemo(() => buildDashboardFirstRunGuide(setupWizard), [setupWizard]);

  const userName =
    [sessionUser?.firstName, sessionUser?.lastName].filter(Boolean).join(' ') ||
    sessionUser?.email ||
    'Admin team';

  return (
    <AppShell>
      <AdminPage>
        <AdminPageHeader
          description={
            loading
              ? 'Syncing the latest commerce signals from orders, products, and customer activity.'
              : `${settings.storeName} is live. Welcome back, ${userName}.`
          }
          eyebrow="Dashboard"
          title="Commerce admin"
          actions={<AdminStatusChip tone="success">Live</AdminStatusChip>}
        />

        <AdminStatsGrid>
          <AdminStatCard label="Orders" meta="Active system queue" value={loading ? '--' : formatCompactNumber(orders.length)} />
          <AdminStatCard label="Gross sales" meta="Across all recorded orders" value={loading ? '--' : formatCurrency(overview.grossSales)} />
          <AdminStatCard label="Active catalog" meta="Products currently sellable" value={loading ? '--' : formatCompactNumber(overview.activeProducts)} />
          <AdminStatCard label="Customers" meta="Profiles available to support" value={loading ? '--' : formatCompactNumber(customers.length)} />
        </AdminStatsGrid>

        <div className={styles.grid}>
          <AdminCard className={styles.primaryCard} variant="panel">
            <div className={styles.cardHeader}>
              <h2 className="font-headline">Recent activity</h2>
              <span className={styles.cardTag}>Operations feed</span>
            </div>

            {loading ? (
              <div className={styles.loadingWrap}>
                <AdminSkeleton variant="table" rows={5} columns={1} />
              </div>
            ) : (
              <div className={styles.activityList}>
                {recentActivity.map((item) => (
                  <Link className={styles.activityRow} href={item.href} key={item.id}>
                    <span className={`material-symbols-outlined ${styles.activityIcon}`} aria-hidden="true">{item.icon}</span>
                    <div className={styles.activityCopy}>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </div>
                    <span className={styles.activityTime}>{item.time}</span>
                  </Link>
                ))}
              </div>
            )}
          </AdminCard>

          <AdminCard className={`${styles.sideCard} ${styles.healthCard}`} variant="card">
            <div className={styles.cardHeader}>
              <h2 className="font-headline">Commerce health</h2>
            </div>
            <div className={styles.metricList}>
              <div><span>AOV</span><strong>{loading ? '--' : formatCurrency(overview.averageOrderValue)}</strong></div>
              <div><span>Inventory units</span><strong>{loading ? '--' : formatCompactNumber(overview.inventoryUnits)}</strong></div>
              <div><span>Low stock products</span><strong>{loading ? '--' : formatCompactNumber(overview.lowStockCount)}</strong></div>
            </div>
          </AdminCard>

          <AdminCard className={`${styles.sideCard} ${styles.linksCard}`} variant="card">
            <div className={styles.cardHeader}>
              <h2 className="font-headline">Quick links</h2>
            </div>
            <div className={styles.linkList}>
              <Link href="/orders">Review order queue</Link>
              <Link href="/products">Update catalog and inventory</Link>
              <Link href="/admin/webhooks">Open delivery logs</Link>
              <Link href="/draft-orders?new=1">Create draft order</Link>
            </div>
          </AdminCard>

          {firstRunGuide ? (
            <AdminCard className={`${styles.sideCard} ${styles.guideCard}`} variant="card">
              <div className={styles.cardHeader}>
                <h2 className="font-headline">First-run setup</h2>
                <AdminStatusChip tone="warning">In progress</AdminStatusChip>
              </div>
              <p className={styles.guideIntro}>Complete these steps to unlock a safe private beta checkout flow.</p>

              <h3 className={styles.guideSectionTitle}>Required</h3>
              <div className={styles.setupGuideList}>
                {firstRunGuide.requiredSteps.map((step, index) => (
                  <div className={styles.setupGuideItem} key={step.id}>
                    <div className={styles.stepMeta}>
                      <strong>{index + 1}. {step.title}</strong>
                      <small>{step.description}</small>
                    </div>
                    <div className={styles.stepActions}>
                      <span className={styles.stepStatus}>{step.statusLabel}</span>
                      <Link href={step.route}>{step.ctaLabel}</Link>
                    </div>
                  </div>
                ))}
              </div>

              <h3 className={styles.guideSectionTitle}>Optional</h3>
              <div className={styles.setupGuideList}>
                {firstRunGuide.optionalSteps.map((step, index) => (
                  <div className={styles.setupGuideItem} key={step.id}>
                    <div className={styles.stepMeta}>
                      <strong>{index + 1}. {step.title}</strong>
                      <small>{step.description}</small>
                    </div>
                    <div className={styles.stepActions}>
                      <span className={styles.stepStatus}>{step.statusLabel}</span>
                      <Link href={step.route}>{step.ctaLabel}</Link>
                    </div>
                  </div>
                ))}
              </div>
            </AdminCard>
          ) : null}
        </div>
      </AdminPage>
    </AppShell>
  );
}
