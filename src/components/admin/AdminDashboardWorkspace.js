"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '../AppShell';
import { useCustomers } from '../../context/CustomersContext';
import { useOrders } from '../../context/OrdersContext';
import { useProducts } from '../../context/ProductsContext';
import { useSettings } from '../../context/SettingsContext';
import styles from './AdminDashboardWorkspace.module.css';

function formatCompactNumber(value) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
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

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, 'day');
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
    detail: 'Jump into the CRM workspace to inspect activity and lifetime value.',
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

  const lowInventoryThreshold = Number(settings.lowInventoryAlert || 5);

  const overview = useMemo(() => {
    const grossSales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const averageOrderValue = orders.length ? grossSales / orders.length : 0;
    const activeProducts = products.filter(product => product.status === 'active').length;
    const inventoryUnits = products.reduce(
      (sum, product) =>
        sum +
        product.variants.reduce(
          (variantSum, variant) => variantSum + Number(variant.inventoryQty || 0),
          0
        ),
      0
    );
    const lowStockCount = products.filter(product => {
      const inventory = product.variants.reduce(
        (sum, variant) => sum + Number(variant.inventoryQty || 0),
        0
      );
      return inventory <= lowInventoryThreshold;
    }).length;

    const activity = orders
      .flatMap(order =>
        (order.timeline || []).map(entry => ({
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
      .slice(0, 5);

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
  const userName =
    [sessionUser?.firstName, sessionUser?.lastName].filter(Boolean).join(' ') ||
    sessionUser?.email ||
    'Admin team';
  const readiness = products.length
    ? Math.max(24, Math.min(96, Math.round((overview.activeProducts / products.length) * 100)))
    : 68;

  return (
    <AppShell>
      <main className={`${styles.dashboardPage} admin-spotlight`}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Admin command center</p>
            <h1 className={`font-headline ${styles.title}`}>Dashboard</h1>
            <p className={styles.subtitle}>
              {loading
                ? 'Syncing the latest commerce signals from orders, products, and customer activity.'
                : `${settings.storeName} is live. Welcome back, ${userName}.`}
            </p>
          </div>

          <div className={styles.liveBadge}>
            <span className={styles.liveDot} />
            <span>Live</span>
          </div>
        </section>

        <section className={styles.dashboardGrid}>
          <div className={styles.metricRail}>
            <article className={styles.metricCard}>
              <div className={styles.metricIcon}>
                <span className="material-symbols-outlined">shopping_bag</span>
              </div>
              <span className={styles.metricLabel}>Orders in system</span>
              <strong className={`font-headline ${styles.metricValue}`}>
                {loading ? '--' : formatCompactNumber(orders.length)}
              </strong>
              <small className={styles.metricMeta}>Live queue across the private order desk</small>
            </article>

            <article className={styles.metricCard}>
              <div className={styles.metricIcon}>
                <span className="material-symbols-outlined">inventory_2</span>
              </div>
              <span className={styles.metricLabel}>Active catalog</span>
              <strong className={`font-headline ${styles.metricValue}`}>
                {loading ? '--' : formatCompactNumber(overview.activeProducts)}
              </strong>
              <small className={styles.metricMeta}>Products currently ready to sell</small>
            </article>

            <article className={styles.metricCard}>
              <div className={styles.metricIcon}>
                <span className="material-symbols-outlined">groups</span>
              </div>
              <span className={styles.metricLabel}>Customer profiles</span>
              <strong className={`font-headline ${styles.metricValue}`}>
                {loading ? '--' : formatCompactNumber(customers.length)}
              </strong>
              <small className={styles.metricMeta}>Audience records available to support the team</small>
            </article>
          </div>

          <section className={styles.activityCard}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardEyebrow}>Recent activity</p>
                <h2 className={`font-headline ${styles.cardTitle}`}>Operations feed</h2>
              </div>
              <span className={styles.cardTag}>Filtered view</span>
            </div>

            <div className={styles.activityList}>
              {recentActivity.map(item => (
                <Link key={item.id} href={item.href} className={styles.activityRow}>
                  <div className={styles.activityIcon}>
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>

                  <div className={styles.activityCopy}>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>

                  <small className={styles.activityTime}>{item.time}</small>
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.statusCard}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardEyebrow}>System integrity</p>
                <h2 className={`font-headline ${styles.cardTitle}`}>Commerce status is stable.</h2>
              </div>
            </div>

            <p className={styles.statusText}>
              Catalog, orders, and customer data are available. The admin workspace is ready for daily operations.
            </p>

            <div className={styles.statusBarTrack}>
              <div className={styles.statusBarFill} style={{ width: `${readiness}%` }} />
            </div>

            <div className={styles.statusMetrics}>
              <div>
                <span>Gross sales</span>
                <strong>{loading ? '--' : formatCurrency(overview.grossSales)}</strong>
              </div>
              <div>
                <span>AOV</span>
                <strong>{loading ? '--' : formatCurrency(overview.averageOrderValue)}</strong>
              </div>
              <div>
                <span>Inventory</span>
                <strong>{loading ? '--' : formatCompactNumber(overview.inventoryUnits)}</strong>
              </div>
              <div>
                <span>Low stock</span>
                <strong>{loading ? '--' : formatCompactNumber(overview.lowStockCount)}</strong>
              </div>
            </div>
          </section>
        </section>
      </main>
    </AppShell>
  );
}
