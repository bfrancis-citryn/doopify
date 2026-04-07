"use client";

import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import { createSeedCustomers, formatCustomerMoney } from '../../lib/customersData';
import styles from './CustomersWorkspace.module.css';

export default function CustomersWorkspace() {
  const [customers, setCustomers] = useState(createSeedCustomers());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || null);

  const visibleCustomers = useMemo(
    () =>
      customers.filter(customer =>
        [customer.name, customer.email, ...(customer.tags || [])].join(' ').toLowerCase().includes(searchQuery.trim().toLowerCase())
      ),
    [customers, searchQuery]
  );

  const selectedCustomer = visibleCustomers.find(customer => customer.id === selectedCustomerId) || customers.find(customer => customer.id === selectedCustomerId) || null;

  return (
    <AppShell onCreateOrder={() => {}} onNotificationsClick={() => {}} onQuickActionClick={() => {}} onSearchChange={event => setSearchQuery(event.target.value)} searchValue={searchQuery}>
      <div className={styles.page}>
        <div className={styles.listPanel}>
          <div className={styles.listHeader}>
            <h2>Customers</h2>
            <button className={styles.primaryButton} type="button">Create customer</button>
          </div>

          <div className={styles.customerList}>
            {visibleCustomers.map(customer => (
              <button key={customer.id} className={selectedCustomer?.id === customer.id ? styles.customerRowActive : styles.customerRow} onClick={() => setSelectedCustomerId(customer.id)} type="button">
                <div>
                  <strong>{customer.name}</strong>
                  <small>{customer.email}</small>
                </div>
                <span>{formatCustomerMoney(customer.totalSpent)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.detailPanel}>
          {selectedCustomer ? (
            <div className={styles.detailCard}>
              <div className={styles.detailHeader}>
                <div>
                  <p className={styles.eyebrow}>Customer profile</p>
                  <h2>{selectedCustomer.name}</h2>
                </div>
              </div>

              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}><span>Total spent</span><strong>{formatCustomerMoney(selectedCustomer.totalSpent)}</strong></div>
                <div className={styles.metricCard}><span>Orders</span><strong>{selectedCustomer.orderCount}</strong></div>
              </div>

              <div className={styles.infoCard}>
                <h3>Contact</h3>
                <p>{selectedCustomer.email}</p>
                <p>{selectedCustomer.phone}</p>
              </div>

              <div className={styles.infoCard}>
                <h3>Default address</h3>
                <p>{selectedCustomer.defaultAddress}</p>
              </div>

              <div className={styles.infoCard}>
                <h3>Tags</h3>
                <div className={styles.tagRow}>
                  {selectedCustomer.tags.map(tag => (
                    <span key={`${selectedCustomer.id}-${tag}`} className={styles.tagChip}>{tag}</span>
                  ))}
                </div>
              </div>

              <div className={styles.infoCard}>
                <h3>Recent orders</h3>
                <div className={styles.recentOrders}>
                  {selectedCustomer.recentOrders.map(order => <span key={`${selectedCustomer.id}-${order}`}>{order}</span>)}
                </div>
              </div>

              <div className={styles.infoCard}>
                <h3>Notes</h3>
                <textarea className={styles.notesInput} onChange={event => setCustomers(current => current.map(customer => customer.id === selectedCustomer.id ? { ...customer, notes: event.target.value } : customer))} rows={5} value={selectedCustomer.notes} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
