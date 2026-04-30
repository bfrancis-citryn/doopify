"use client";

import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminDrawer from '../admin/ui/AdminDrawer';
import AdminEmptyState from '../admin/ui/AdminEmptyState';
import AdminInput from '../admin/ui/AdminInput';
import AdminPage from '../admin/ui/AdminPage';
import AdminPageHeader from '../admin/ui/AdminPageHeader';
import AdminStatCard, { AdminStatsGrid } from '../admin/ui/AdminStatCard';
import AdminTable from '../admin/ui/AdminTable';
import AdminToolbar from '../admin/ui/AdminToolbar';
import { useCustomers } from '../../context/CustomersContext';
import { formatCustomerMoney } from '../../lib/customersData';
import styles from './CustomersWorkspace.module.css';

export default function CustomersWorkspace() {
  const { customers, setCustomers } = useCustomers();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const visibleCustomers = useMemo(
    () =>
      customers.filter((customer) =>
        [customer.name, customer.email, ...(customer.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      ),
    [customers, searchQuery]
  );

  const selectedCustomer =
    visibleCustomers.find((customer) => customer.id === selectedCustomerId) ||
    customers.find((customer) => customer.id === selectedCustomerId) ||
    null;

  const totalRevenue = useMemo(
    () => visibleCustomers.reduce((sum, customer) => sum + Number(customer.totalSpent || 0), 0),
    [visibleCustomers]
  );

  const columns = [
    { key: 'name', header: 'Customer', render: (customer) => <strong>{customer.name}</strong> },
    { key: 'email', header: 'Email', render: (customer) => customer.email },
    { key: 'orders', header: 'Orders', render: (customer) => customer.orderCount },
    { key: 'spent', header: 'Total spent', render: (customer) => formatCustomerMoney(customer.totalSpent) },
    {
      key: 'tags',
      header: 'Tags',
      render: (customer) => (
        <span className={styles.tagsInline}>{(customer.tags || []).slice(0, 2).join(', ') || 'None'}</span>
      ),
    },
  ];

  return (
    <AppShell>
      <AdminPage>
        <AdminPageHeader
          actions={<AdminButton size="sm" variant="secondary">Create customer</AdminButton>}
          description="Customer profiles, spend, and lifecycle context."
          eyebrow="Customers"
          title="Customer desk"
        />

        <AdminStatsGrid>
          <AdminStatCard label="Profiles" value={String(visibleCustomers.length)} />
          <AdminStatCard label="Total revenue" value={formatCustomerMoney(totalRevenue)} />
          <AdminStatCard label="Avg spend" value={visibleCustomers.length ? formatCustomerMoney(totalRevenue / visibleCustomers.length) : '$0.00'} />
          <AdminStatCard label="Returning" value={String(visibleCustomers.filter((customer) => Number(customer.orderCount || 0) > 1).length)} />
        </AdminStatsGrid>

        <AdminCard className={styles.tablePanel} variant="panel">
          <AdminToolbar>
            <AdminInput
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, email, or tags..."
              type="search"
              value={searchQuery}
            />
            <span className={styles.meta}>{visibleCustomers.length} customers</span>
          </AdminToolbar>

          {visibleCustomers.length ? (
            <AdminTable
              columns={columns}
              onRowClick={(customer) => setSelectedCustomerId(customer.id)}
              rows={visibleCustomers}
              selectedId={selectedCustomerId}
            />
          ) : (
            <AdminEmptyState
              description="No customers match your current filters."
              icon="groups"
              onAction={() => setSearchQuery('')}
              actionLabel="Clear search"
              title="No customers"
            />
          )}
        </AdminCard>

        <AdminDrawer
          onClose={() => setSelectedCustomerId(null)}
          open={Boolean(selectedCustomer)}
          title={selectedCustomer?.name || 'Customer'}
          subtitle={selectedCustomer ? selectedCustomer.email : ''}
          contextItems={[
            { label: 'Customers' },
            { label: selectedCustomer?.name || 'Profile', current: true },
          ]}
        >
          {selectedCustomer ? (
            <div className={styles.drawerBody}>
              <AdminStatsGrid className={styles.drawerStats}>
                <AdminStatCard label="Total spent" value={formatCustomerMoney(selectedCustomer.totalSpent)} />
                <AdminStatCard label="Orders" value={String(selectedCustomer.orderCount)} />
              </AdminStatsGrid>

              <AdminCard className={styles.drawerSection} variant="card">
                <h3>Contact</h3>
                <p>{selectedCustomer.email}</p>
                <p>{selectedCustomer.phone || 'No phone on file'}</p>
              </AdminCard>

              <AdminCard className={styles.drawerSection} variant="card">
                <h3>Default address</h3>
                <p>{selectedCustomer.defaultAddress || 'No default address set'}</p>
              </AdminCard>

              <AdminCard className={styles.drawerSection} variant="card">
                <h3>Tags</h3>
                <div className={styles.tagRow}>
                  {(selectedCustomer.tags || []).map((tag) => (
                    <span className={styles.tagChip} key={`${selectedCustomer.id}-${tag}`}>{tag}</span>
                  ))}
                </div>
              </AdminCard>

              <AdminCard className={styles.drawerSection} variant="card">
                <h3>Recent orders</h3>
                <div className={styles.orderRow}>
                  {(selectedCustomer.recentOrders || []).length
                    ? selectedCustomer.recentOrders.map((order) => <span key={`${selectedCustomer.id}-${order}`}>{order}</span>)
                    : <span>No recent orders.</span>}
                </div>
              </AdminCard>

              <AdminCard className={styles.drawerSection} variant="card">
                <h3>Notes</h3>
                <textarea
                  className={styles.notesInput}
                  onChange={(event) =>
                    setCustomers((current) =>
                      current.map((customer) =>
                        customer.id === selectedCustomer.id ? { ...customer, notes: event.target.value } : customer
                      )
                    )
                  }
                  rows={6}
                  value={selectedCustomer.notes}
                />
              </AdminCard>
            </div>
          ) : null}
        </AdminDrawer>
      </AdminPage>
    </AppShell>
  );
}