"use client";

import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminDrawer from '../admin/ui/AdminDrawer';
import AdminEmptyState from '../admin/ui/AdminEmptyState';
import AdminField from '../admin/ui/AdminField';
import AdminInput from '../admin/ui/AdminInput';
import AdminPage from '../admin/ui/AdminPage';
import AdminPageHeader from '../admin/ui/AdminPageHeader';
import AdminStatCard, { AdminStatsGrid } from '../admin/ui/AdminStatCard';
import AdminStatusChip from '../admin/ui/AdminStatusChip';
import AdminTable from '../admin/ui/AdminTable';
import AdminTextarea from '../admin/ui/AdminTextarea';
import AdminToolbar from '../admin/ui/AdminToolbar';
import { useCustomers } from '../../context/CustomersContext';
import { formatCustomerMoney } from '../../lib/customersData';
import styles from './CustomersWorkspace.module.css';

const EMPTY_CREATE_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  note: '',
  tags: '',
  shippingAddress: '',
};

export default function CustomersWorkspace() {
  const { customers, setCustomers, createCustomer } = useCustomers();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');

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

  function patchCreateForm(patch) {
    setCreateForm((f) => ({ ...f, ...patch }));
  }

  function openCreateDrawer() {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError('');
    setCreateDrawerOpen(true);
  }

  function closeCreateDrawer() {
    setCreateDrawerOpen(false);
    setCreateError('');
  }

  async function handleCreateCustomer(event) {
    event.preventDefault();
    if (createSaving) return;
    if (!createForm.email.trim()) {
      setCreateError('Email is required.');
      return;
    }

    setCreateSaving(true);
    setCreateError('');

    try {
      const tags = createForm.tags
        ? createForm.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined;

      const result = await createCustomer({
        email: createForm.email.trim(),
        firstName: createForm.firstName.trim() || undefined,
        lastName: createForm.lastName.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        note: createForm.note.trim() || undefined,
        tags,
        shippingAddress: createForm.shippingAddress.trim() || undefined,
      });

      if (result.duplicate) {
        setCreateError(`A customer with this email already exists.`);
        setSelectedCustomerId(result.customer.id);
        closeCreateDrawer();
        return;
      }

      closeCreateDrawer();
      setSelectedCustomerId(result.customer.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create customer.');
    } finally {
      setCreateSaving(false);
    }
  }

  return (
    <AppShell>
      <AdminPage>
        <AdminPageHeader
          actions={<AdminButton onClick={openCreateDrawer} size="sm" variant="secondary">Create customer</AdminButton>}
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
                    <AdminStatusChip key={`${selectedCustomer.id}-${tag}`} tone="neutral">{tag}</AdminStatusChip>
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
                <AdminTextarea
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

        <AdminDrawer
          onClose={closeCreateDrawer}
          open={createDrawerOpen}
          subtitle="Add a customer profile. Email is required."
          title="Create customer"
        >
          <form className={styles.drawerBody} onSubmit={handleCreateCustomer}>
            <AdminCard className={styles.drawerSection} variant="card">
              <h3>Contact</h3>
              <AdminField label="Email *">
                <AdminInput
                  autoComplete="email"
                  onChange={(e) => patchCreateForm({ email: e.target.value })}
                  placeholder="customer@example.com"
                  required
                  type="email"
                  value={createForm.email}
                />
              </AdminField>
              <AdminField label="First name">
                <AdminInput
                  onChange={(e) => patchCreateForm({ firstName: e.target.value })}
                  placeholder="Alex"
                  value={createForm.firstName}
                />
              </AdminField>
              <AdminField label="Last name">
                <AdminInput
                  onChange={(e) => patchCreateForm({ lastName: e.target.value })}
                  placeholder="Rivera"
                  value={createForm.lastName}
                />
              </AdminField>
              <AdminField label="Phone">
                <AdminInput
                  onChange={(e) => patchCreateForm({ phone: e.target.value })}
                  placeholder="+1 555 000 0000"
                  type="tel"
                  value={createForm.phone}
                />
              </AdminField>
            </AdminCard>

            <AdminCard className={styles.drawerSection} variant="card">
              <h3>Tags</h3>
              <AdminField hint="Comma-separated. Example: vip, wholesale">
                <AdminInput
                  onChange={(e) => patchCreateForm({ tags: e.target.value })}
                  placeholder="vip, wholesale"
                  value={createForm.tags}
                />
              </AdminField>
            </AdminCard>

            <AdminCard className={styles.drawerSection} variant="card">
              <h3>Shipping address</h3>
              <AdminField hint="Street address. Additional address details can be added after creation.">
                <AdminInput
                  onChange={(e) => patchCreateForm({ shippingAddress: e.target.value })}
                  placeholder="123 Main St, Portland, OR 97201"
                  value={createForm.shippingAddress}
                />
              </AdminField>
            </AdminCard>

            <AdminCard className={styles.drawerSection} variant="card">
              <h3>Notes</h3>
              <AdminTextarea
                onChange={(e) => patchCreateForm({ note: e.target.value })}
                placeholder="Internal notes about this customer."
                rows={4}
                value={createForm.note}
              />
            </AdminCard>

            {createError ? (
              <p className={styles.drawerSection} style={{ color: 'var(--color-danger, #dc2626)', fontSize: '13px' }}>
                {createError}
              </p>
            ) : null}

            <div className={styles.drawerSection}>
              <AdminButton disabled={createSaving} size="sm" type="submit" variant="primary">
                {createSaving ? 'Creating...' : 'Create customer'}
              </AdminButton>
              <AdminButton disabled={createSaving} onClick={closeCreateDrawer} size="sm" variant="ghost" type="button">
                Cancel
              </AdminButton>
            </div>
          </form>
        </AdminDrawer>
      </AdminPage>
    </AppShell>
  );
}
