"use client";

import { useMemo } from 'react';
import AppShell from '../AppShell';
import { useOrders } from '../../context/OrdersContext';
import { useCustomers } from '../../context/CustomersContext';
import { useDiscounts } from '../../context/DiscountsContext';
import { useProducts } from '../../context/ProductsContext';
import styles from './AnalyticsWorkspace.module.css';

export default function AnalyticsWorkspace() {
  const { orders } = useOrders();
  const { customers } = useCustomers();
  const { discounts } = useDiscounts();
  const { products } = useProducts();

  const metrics = useMemo(() => {
    const grossSales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const averageOrderValue = orders.length ? grossSales / orders.length : 0;
    const repeatCustomers = customers.filter(customer => Number(customer.orderCount || 0) > 1).length;
    const topProducts = [...products]
      .map(product => ({ title: product.title, inventory: product.variants.reduce((sum, variant) => sum + Number(variant.inventoryQty || 0), 0) }))
      .sort((a, b) => a.inventory - b.inventory)
      .slice(0, 5);
    const topDiscounts = [...discounts].sort((a, b) => Number(b.usageCount || 0) - Number(a.usageCount || 0)).slice(0, 5);

    return { grossSales, averageOrderValue, repeatCustomers, topProducts, topDiscounts };
  }, [customers, discounts, orders, products]);

  return (
    <AppShell onCreateOrder={() => {}} onNotificationsClick={() => {}} onQuickActionClick={() => {}} onSearchChange={() => {}} searchValue="">
      <div className={styles.page}>
        <div className={styles.metricGrid}>
          <div className={styles.metricCard}><span>Gross sales</span><strong>${metrics.grossSales.toFixed(2)}</strong></div>
          <div className={styles.metricCard}><span>Orders</span><strong>{orders.length}</strong></div>
          <div className={styles.metricCard}><span>AOV</span><strong>${metrics.averageOrderValue.toFixed(2)}</strong></div>
          <div className={styles.metricCard}><span>Repeat customers</span><strong>{metrics.repeatCustomers}</strong></div>
        </div>

        <div className={styles.gridTwo}>
          <div className={styles.card}>
            <h2>Top discount usage</h2>
            <div className={styles.list}>
              {metrics.topDiscounts.map(discount => (
                <div key={discount.id} className={styles.row}><span>{discount.title}</span><strong>{discount.usageCount} uses</strong></div>
              ))}
            </div>
          </div>
          <div className={styles.card}>
            <h2>Inventory pressure</h2>
            <div className={styles.list}>
              {metrics.topProducts.map(product => (
                <div key={product.title} className={styles.row}><span>{product.title}</span><strong>{product.inventory} in stock</strong></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
