"use client";

import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import { createSeedProducts } from '../../lib/productUtils';
import { createSeedCustomers, formatCustomerMoney } from '../../lib/customersData';
import { createSeedDiscounts } from '../../lib/discountsData';
import { calculateDraftTotals, createDraftOrderSeed } from '../../lib/draftOrdersData';
import styles from './DraftOrdersWorkspace.module.css';

export default function DraftOrdersWorkspace() {
  const [products] = useState(createSeedProducts());
  const [customers] = useState(createSeedCustomers());
  const [discounts] = useState(createSeedDiscounts());
  const [draftOrder, setDraftOrder] = useState(() => createDraftOrderSeed(createSeedProducts(), createSeedCustomers(), createSeedDiscounts()));

  const totals = useMemo(() => calculateDraftTotals(draftOrder, discounts), [draftOrder, discounts]);
  const selectedCustomer = customers.find(customer => customer.id === draftOrder.customerId) || null;

  return (
    <AppShell onCreateOrder={() => {}} onNotificationsClick={() => {}} onQuickActionClick={() => {}} onSearchChange={() => {}} searchValue="">
      <div className={styles.page}>
        <div className={styles.builderPanel}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>Draft order</p>
              <h2 className={styles.title}>Create a draft order</h2>
            </div>

            <label className={styles.field}>
              <span>Customer</span>
              <select className={styles.input} onChange={event => setDraftOrder(current => ({ ...current, customerId: event.target.value }))} value={draftOrder.customerId}>
                {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>Line items</p>
              <h2 className={styles.title}>Products</h2>
            </div>

            <div className={styles.lineItems}>
              {draftOrder.lineItems.map((item, index) => (
                <div key={item.id} className={styles.lineItemRow}>
                  <select
                    className={styles.input}
                    onChange={event => {
                      const product = products.find(entry => entry.id === event.target.value);
                      if (!product) return;
                      setDraftOrder(current => ({
                        ...current,
                        lineItems: current.lineItems.map(lineItem =>
                          lineItem.id === item.id
                            ? {
                                ...lineItem,
                                productId: product.id,
                                title: product.title,
                                variantTitle: product.variants?.[0]?.title || 'Default',
                                price: Number(product.basePrice || 0),
                              }
                            : lineItem
                        ),
                      }));
                    }}
                    value={item.productId}
                  >
                    {products.map(product => <option key={product.id} value={product.id}>{product.title}</option>)}
                  </select>

                  <input className={styles.qtyInput} min="1" onChange={event => setDraftOrder(current => ({ ...current, lineItems: current.lineItems.map(lineItem => lineItem.id === item.id ? { ...lineItem, quantity: Number(event.target.value || 1) } : lineItem) }))} type="number" value={item.quantity} />
                  <div className={styles.linePrice}>${Number(item.price || 0).toFixed(2)}</div>
                  <button className={styles.removeButton} onClick={() => setDraftOrder(current => ({ ...current, lineItems: current.lineItems.filter(lineItem => lineItem.id !== item.id) }))} type="button">Remove</button>
                </div>
              ))}
            </div>

            <button className={styles.secondaryButton} onClick={() => setDraftOrder(current => ({ ...current, lineItems: [...current.lineItems, { id: `draft_item_${Date.now()}`, productId: products[0].id, title: products[0].title, variantTitle: products[0].variants?.[0]?.title || 'Default', quantity: 1, price: Number(products[0].basePrice || 0) }] }))} type="button">Add custom item</button>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>Discounts + shipping</p>
              <h2 className={styles.title}>Adjust totals</h2>
            </div>

            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>Discount</span>
                <select className={styles.input} onChange={event => setDraftOrder(current => ({ ...current, discountId: event.target.value }))} value={draftOrder.discountId}>
                  <option value="">No discount</option>
                  {discounts.map(discount => <option key={discount.id} value={discount.id}>{discount.title}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>Shipping</span>
                <input className={styles.input} onChange={event => setDraftOrder(current => ({ ...current, shippingAmount: Number(event.target.value || 0) }))} type="number" value={draftOrder.shippingAmount} />
              </label>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>Internal note</p>
              <h2 className={styles.title}>Notes</h2>
            </div>
            <textarea className={styles.notesInput} onChange={event => setDraftOrder(current => ({ ...current, notes: event.target.value }))} rows={5} value={draftOrder.notes} />
          </div>
        </div>

        <div className={styles.summaryPanel}>
          <div className={styles.summaryCard}>
            <p className={styles.eyebrow}>Summary</p>
            <h2 className={styles.title}>Draft order totals</h2>

            <div className={styles.summaryBlock}>
              <span>Customer</span>
              <strong>{selectedCustomer?.name || 'No customer selected'}</strong>
              <small>{selectedCustomer?.email}</small>
            </div>

            <div className={styles.summaryRows}>
              <div><span>Subtotal</span><strong>${totals.subtotal.toFixed(2)}</strong></div>
              <div><span>Discount</span><strong>- ${totals.discountAmount.toFixed(2)}</strong></div>
              <div><span>Shipping</span><strong>${totals.shipping.toFixed(2)}</strong></div>
              <div className={styles.totalRow}><span>Total</span><strong>${totals.total.toFixed(2)}</strong></div>
            </div>

            <div className={styles.customerSnapshot}>
              <span>Customer value</span>
              <strong>{selectedCustomer ? formatCustomerMoney(selectedCustomer.totalSpent) : '$0.00'}</strong>
            </div>

            <div className={styles.summaryActions}>
              <button className={styles.secondaryButton} type="button">Save draft</button>
              <button className={styles.primaryButton} type="button">Convert to order</button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
