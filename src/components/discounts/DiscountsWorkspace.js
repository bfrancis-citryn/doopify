"use client";

import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import { useDiscounts } from '../../context/DiscountsContext';
import { DISCOUNT_METHODS, DISCOUNT_STATUSES, DISCOUNT_TYPES } from '../../lib/discountsData';
import styles from './DiscountsWorkspace.module.css';

function StatusPill({ children, tone }) {
  return <span className={`${styles.statusPill} ${styles[`tone_${tone}`]}`}>{children}</span>;
}

function createDiscountDraft(type) {
  return {
    id: `draft_${Date.now()}`,
    title: '',
    code: type === 'discount code' ? '' : '',
    type,
    method: 'amount off products',
    status: 'scheduled',
    combinesWith: [],
    startsAt: new Date().toISOString().slice(0, 16),
    endsAt: '',
    usageCount: 0,
    summary: '',
    customerEligibility: 'Everyone',
    salesChannel: 'All channels',
    valueType: 'percentage',
    value: '',
    minimumRequirementType: 'none',
    minimumRequirementValue: '',
    usageLimit: '',
    appliesTo: 'All products',
  };
}

export default function DiscountsWorkspace() {
  const { discounts, addDiscount, updateDiscount } = useDiscounts();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [selectedDiscountId, setSelectedDiscountId] = useState(discounts[0]?.id || null);
  const [builderMode, setBuilderMode] = useState(null);
  const [draftDiscount, setDraftDiscount] = useState(null);

  const visibleDiscounts = useMemo(
    () =>
      discounts.filter(discount => {
        const searchMatch = [discount.title, discount.method, discount.summary].join(' ').toLowerCase().includes(searchQuery.trim().toLowerCase());
        const typeMatch = typeFilter === 'all' || discount.type === typeFilter;
        const statusMatch = statusFilter === 'all' || discount.status === statusFilter;
        const methodMatch = methodFilter === 'all' || discount.method === methodFilter;
        return searchMatch && typeMatch && statusMatch && methodMatch;
      }),
    [discounts, searchQuery, statusFilter, typeFilter, methodFilter]
  );

  const selectedDiscount = visibleDiscounts.find(discount => discount.id === selectedDiscountId) || discounts.find(discount => discount.id === selectedDiscountId) || null;

  const openBuilder = type => {
    setBuilderMode(type);
    setDraftDiscount(createDiscountDraft(type));
  };

  const openEditor = discount => {
    setBuilderMode(discount.type);
    setDraftDiscount({ ...discount });
    setSelectedDiscountId(discount.id);
  };

  const saveDraftDiscount = () => {
    if (!draftDiscount?.title.trim()) {
      return;
    }

    const nextDiscount = {
      ...draftDiscount,
      title: draftDiscount.title.trim(),
      summary:
        draftDiscount.summary.trim() ||
        `${draftDiscount.value || 'Custom'} ${draftDiscount.valueType === 'percentage' ? '% off' : 'off'} via ${draftDiscount.method}`,
      status: draftDiscount.startsAt ? 'scheduled' : 'active',
    };

    const isExisting = discounts.some(discount => discount.id === nextDiscount.id);
    if (isExisting) {
      updateDiscount(nextDiscount.id, () => nextDiscount);
    } else {
      addDiscount(nextDiscount);
    }

    setSelectedDiscountId(nextDiscount.id);
    setBuilderMode(null);
    setDraftDiscount(null);
  };

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
              <button className={styles.secondaryButton} onClick={() => openBuilder('automatic')} type="button">Create automatic discount</button>
              <button className={styles.primaryButton} onClick={() => openBuilder('discount code')} type="button">Create discount code</button>
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
            <select className={styles.filterSelect} onChange={event => setMethodFilter(event.target.value)} value={methodFilter}>
              <option value="all">All methods</option>
              {DISCOUNT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
            </select>
          </div>

          <div className={styles.discountList}>
            {visibleDiscounts.map(discount => (
              <button key={discount.id} className={selectedDiscount?.id === discount.id && !builderMode ? styles.discountRowActive : styles.discountRow} onClick={() => { setSelectedDiscountId(discount.id); setBuilderMode(null); }} type="button">
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
          {builderMode && draftDiscount ? (
            <div className={styles.detailCard}>
              <div className={styles.builderHeader}>
                <div>
                  <p className={styles.eyebrow}>{builderMode === 'discount code' ? 'Create discount code' : 'Create automatic discount'}</p>
                  <h2 className={styles.detailTitle}>Set up your discount</h2>
                </div>
                <div className={styles.headerActions}>
                  <button className={styles.secondaryButton} onClick={() => { setBuilderMode(null); setDraftDiscount(null); }} type="button">Cancel</button>
                  <button className={styles.primaryButton} onClick={saveDraftDiscount} type="button">Save discount</button>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.infoCard}>
                  <h3>{builderMode === 'discount code' ? 'Code' : 'Title'}</h3>
                  <input className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, title: event.target.value, code: event.target.value }))} placeholder={builderMode === 'discount code' ? 'SUMMER20' : 'Summer auto discount'} type="text" value={draftDiscount.title} />
                </div>
                <div className={styles.infoCard}>
                  <h3>Method</h3>
                  <select className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, method: event.target.value }))} value={draftDiscount.method}>
                    {DISCOUNT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.infoCard}>
                  <h3>Value</h3>
                  <div className={styles.inlineControls}>
                    <select className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, valueType: event.target.value }))} value={draftDiscount.valueType}>
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed amount</option>
                    </select>
                    <input className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, value: event.target.value }))} placeholder="10" type="text" value={draftDiscount.value} />
                  </div>
                </div>
                <div className={styles.infoCard}>
                  <h3>Applies to</h3>
                  <select className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, appliesTo: event.target.value }))} value={draftDiscount.appliesTo}>
                    <option>All products</option>
                    <option>Specific collections</option>
                    <option>Specific products</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.infoCard}>
                  <h3>Minimum requirements</h3>
                  <select className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, minimumRequirementType: event.target.value }))} value={draftDiscount.minimumRequirementType}>
                    <option value="none">None</option>
                    <option value="subtotal">Minimum purchase amount</option>
                    <option value="quantity">Minimum quantity of items</option>
                  </select>
                  {draftDiscount.minimumRequirementType !== 'none' ? <input className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, minimumRequirementValue: event.target.value }))} placeholder="50" type="text" value={draftDiscount.minimumRequirementValue} /> : null}
                </div>
                <div className={styles.infoCard}>
                  <h3>Customer eligibility</h3>
                  <select className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, customerEligibility: event.target.value }))} value={draftDiscount.customerEligibility}>
                    <option>Everyone</option>
                    <option>Specific customer segment</option>
                    <option>New customers</option>
                  </select>
                </div>
              </div>

              <div className={styles.infoCard}>
                <h3>Combinations</h3>
                <div className={styles.checkboxList}>
                  {['product discounts', 'order discounts', 'shipping discounts'].map(item => {
                    const checked = draftDiscount.combinesWith.includes(item);
                    return (
                      <label key={item} className={styles.checkboxRow}>
                        <input
                          checked={checked}
                          onChange={event =>
                            setDraftDiscount(current => ({
                              ...current,
                              combinesWith: event.target.checked
                                ? [...new Set([...current.combinesWith, item])]
                                : current.combinesWith.filter(existingItem => existingItem !== item),
                            }))
                          }
                          type="checkbox"
                        />
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.infoCard}>
                  <h3>Active dates</h3>
                  <input className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, startsAt: event.target.value }))} type="datetime-local" value={draftDiscount.startsAt} />
                  <input className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, endsAt: event.target.value }))} type="datetime-local" value={draftDiscount.endsAt} />
                </div>
                <div className={styles.infoCard}>
                  <h3>Usage limits</h3>
                  <input className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, usageLimit: event.target.value }))} placeholder="No limit" type="text" value={draftDiscount.usageLimit} />
                  <input className={styles.formInput} onChange={event => setDraftDiscount(current => ({ ...current, summary: event.target.value }))} placeholder="Internal summary" type="text" value={draftDiscount.summary} />
                </div>
              </div>
            </div>
          ) : selectedDiscount ? (
            <div className={styles.detailCard}>
              <div className={styles.builderHeader}>
                <div>
                  <p className={styles.eyebrow}>Discount detail</p>
                  <h2 className={styles.detailTitle}>{selectedDiscount.title}</h2>
                </div>
                <div className={styles.headerActions}>
                  <button className={styles.secondaryButton} onClick={() => openEditor(selectedDiscount)} type="button">Edit discount</button>
                </div>
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
                <small>Starts {new Date(selectedDiscount.startsAt).toLocaleDateString()} · Ends {selectedDiscount.endsAt ? new Date(selectedDiscount.endsAt).toLocaleDateString() : 'No end date'}</small>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
