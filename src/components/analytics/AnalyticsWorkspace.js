"use client";

import { useMemo } from 'react';
import AppShell from '../AppShell';
import { useOrders } from '../../context/OrdersContext';
import { useCustomers } from '../../context/CustomersContext';
import { useDiscounts } from '../../context/DiscountsContext';
import { useProducts } from '../../context/ProductsContext';
import AdminCard from '../admin/ui/AdminCard';
import AdminEmptyState from '../admin/ui/AdminEmptyState';
import AdminPage from '../admin/ui/AdminPage';
import AdminPageHeader from '../admin/ui/AdminPageHeader';
import AdminSkeleton from '../admin/ui/AdminSkeleton';
import AdminStatCard, { AdminStatsGrid } from '../admin/ui/AdminStatCard';
import AdminTable from '../admin/ui/AdminTable';
import AdminToolbar from '../admin/ui/AdminToolbar';
import styles from './AnalyticsWorkspace.module.css';

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function AnalyticsWorkspace() {
  const { orders, loading: ordersLoading } = useOrders();
  const { customers, loading: customersLoading } = useCustomers();
  const { discounts, loading: discountsLoading } = useDiscounts();
  const { products, loading: productsLoading } = useProducts();

  const isLoading = ordersLoading || customersLoading || discountsLoading || productsLoading;

  const metrics = useMemo(() => {
    const grossSales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const averageOrderValue = orders.length ? grossSales / orders.length : 0;
    const repeatCustomers = customers.filter((customer) => Number(customer.orderCount || 0) > 1).length;
    const topProducts = [...products]
      .map((product) => ({
        id: product.id,
        title: product.title,
        inventory: product.variants.reduce((sum, variant) => sum + Number(variant.inventoryQty || 0), 0),
      }))
      .sort((a, b) => a.inventory - b.inventory)
      .slice(0, 6);
    const topDiscounts = [...discounts]
      .sort((a, b) => Number(b.usageCount || 0) - Number(a.usageCount || 0))
      .slice(0, 6);

    return { grossSales, averageOrderValue, repeatCustomers, topProducts, topDiscounts };
  }, [customers, discounts, orders, products]);

  return (
    <AppShell>
      <AdminPage>
        <AdminPageHeader
          description="Live commerce performance snapshots across sales, customers, discounts, and inventory."
          eyebrow="Analytics"
          title="Business pulse"
        />

        <AdminStatsGrid>
          <AdminStatCard label="Gross sales" value={formatMoney(metrics.grossSales)} />
          <AdminStatCard label="Orders" value={String(orders.length)} />
          <AdminStatCard label="Average order value" value={formatMoney(metrics.averageOrderValue)} />
          <AdminStatCard label="Repeat customers" value={String(metrics.repeatCustomers)} />
        </AdminStatsGrid>

        <AdminCard className={styles.panel} variant="panel">
          <AdminToolbar>
            <span className={styles.toolbarText}>Performance snapshots</span>
          </AdminToolbar>

          <div className={styles.gridTwo}>
            <AdminCard className={styles.snapshotCard} variant="card">
              <h2 className={styles.snapshotTitle}>Top discount usage</h2>
              {isLoading ? (
                <AdminSkeleton rows={6} variant="table" />
              ) : metrics.topDiscounts.length ? (
                <AdminTable
                  columns={[
                    { key: 'title', header: 'Discount', render: (discount) => discount.title },
                    { key: 'method', header: 'Method', render: (discount) => discount.method },
                    { key: 'usageCount', header: 'Usage', render: (discount) => `${discount.usageCount} uses` },
                  ]}
                  rows={metrics.topDiscounts}
                />
              ) : (
                <AdminEmptyState
                  description="Discount performance will appear after checkout usage data accumulates."
                  icon="sell"
                  title="No discount activity yet"
                />
              )}
            </AdminCard>

            <AdminCard className={styles.snapshotCard} variant="card">
              <h2 className={styles.snapshotTitle}>Inventory pressure</h2>
              {isLoading ? (
                <AdminSkeleton rows={6} variant="table" />
              ) : metrics.topProducts.length ? (
                <AdminTable
                  columns={[
                    { key: 'title', header: 'Product', render: (product) => product.title },
                    { key: 'inventory', header: 'Available', render: (product) => `${product.inventory} in stock` },
                  ]}
                  rows={metrics.topProducts}
                />
              ) : (
                <AdminEmptyState
                  description="Inventory trends appear here once products are available in the catalog."
                  icon="inventory_2"
                  title="No inventory data yet"
                />
              )}
            </AdminCard>
          </div>
        </AdminCard>
      </AdminPage>
    </AppShell>
  );
}
