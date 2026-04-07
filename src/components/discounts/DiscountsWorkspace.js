"use client";

import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import { DISCOUNT_METHODS, DISCOUNT_STATUSES, DISCOUNT_TYPES, createSeedDiscounts } from '../../lib/discountsData';
import styles from './DiscountsWorkspace.module.css';

function StatusPill({ children, tone }) {
  return <span className={`${styles.statusPill} ${styles[`tone_${tone}`]}`}>{children}</span>;
}

export default function DiscountsWorkspace() {
  const [discounts] = useState(createSeedDiscounts());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDiscountId, setSelectedDiscountId] = useState(discounts[0]?.id || null);

  const visibleDiscounts = useMemo(
    () =>
      discounts.filter(discount => {
        const searchMatch = [discount.title, discount.method, discount.summary].join(' ').toLowerCase().includes(searchQuery.trim().toLowerCase());
        const typeMatch = typeFilter === 'all' || discount.type === typeFilter;
        const statusMatch = statusFilter === 'all' || discount.status === statusFilter;
        return searchMatch && typeMatch && statusMatch;
      }),
    [discounts, searchQuery, statusFilter, typeFilter]
  );

  const selectedDiscount = visibleDiscounts.find(discount => discount.id === selectedDiscountId) || discounts.find(discount => discount.id === selectedDiscountId) || null;

  return (
    <AppShell onCreateOrder={() => {}} onNotificationsClick={() => {}} onQuickActionClick={() => {}} onSearchChange={event => setSearchQuery(event.target.value)} searchValue={searchQuery}>
      <div className={styles.page}>
        <div className={styles.listPanel}>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Discounts</p>
              <h2 className={styles.title}>Manage discount codes and automatic discounts</h2>
            </div>
            <div className={styles.headerActions}>
              <button className={styles.secondaryButton} type="button">Create automatic discount</button>
              <button className={styles.primaryButton} type="button">Create discount code</button>
            </div>
          </div>

          <div className={styles.filterRow}>
            <select className={styles.filterSelect} onChange={event => setTypeFilter(event.target.value)} value={typeFilter}>
              <option value="all">All types</option>
              {DISCOUNT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <select className={styles.filterSelect} onChange={event => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All status</option>
              {DISCOUNT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <select className={styles.filterSelect} value="all" onChange={() => {}}>
              <option value="all">All methods</option>
              {DISCOUNT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
            </select>
          </div>

          <div className={styles.discountList}>
            {visibleDiscounts.map(discount => (
              <button key={discount.id} className={selectedDiscount?.id === discount.id ? styles.discountRowActive : styles.discountRow} onClick={() => setSelectedDiscountId(discount.id)} type="button">
                <div className={styles.discountMain}>
                  <strong>{discount.title}</strong>
                  <small>{discount.summary}</small>
                </div>
                <div className={styles.discountMeta}>
                  <StatusPill tone={discount.status}>{discount.status}</StatusPill>
                  <small>{discount.type}</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.detailPanel}>
          {selectedDiscount ? (
            <div className={styles.detailCard}>
              <div>
                <p className={styles.eyebrow}>Discount detail</p>
                <h2 className={styles.detailTitle}>{selectedDiscount.title}</h2>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.infoCard}><h3>Method</h3><p>{selectedDiscount.method}</p></div>
                <div className={styles.infoCard}><h3>Status</h3><StatusPill tone={selectedDiscount.status}>{selectedDiscount.status}</StatusPill></div>
                <div className={styles.infoCard}><h3>Customer eligibility</h3><p>{selectedDiscount.customerEligibility}</p></div>
                <div className={styles.infoCard}><h3>Sales channels</h3><p>{selectedDiscount.salesChannel}</p></div>
              </div>

              <div className={styles.infoCard}>
                <h3>Combines with</h3>
                <div className={styles.tagRow}>
                  {selectedDiscount.combinesWith.length ? selectedDiscount.combinesWith.map(item => <span key={`${selectedDiscount.id}-${item}`} className={styles.tagChip}>{item}</span>) : <span className={styles.emptyText}>Doesn’t combine with other discounts</span>}
                </div>
              </div>

              <div className={styles.infoCard}>
                <h3>Performance</h3>
                <p>{selectedDiscount.usageCount} uses</p>
                <small>Starts {new Date(selectedDiscount.startsAt).toLocaleDateString()} · Ends {new Date(selectedDiscount.endsAt).toLocaleDateString()}</small>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
