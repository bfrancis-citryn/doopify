"use client";

import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import { useOrders } from '../../context/OrdersContext';
import { createSeedProducts } from '../../lib/productUtils';
import { createSeedCustomers, formatCustomerMoney } from '../../lib/customersData';
import { createSeedDiscounts } from '../../lib/discountsData';
import { calculateDraftTotals, convertDraftOrderToOrder, createDraftLineItemFromProduct, createDraftOrderSeed } from '../../lib/draftOrdersData';
import styles from './DraftOrdersWorkspace.module.css';

export default function DraftOrdersWorkspace() {
  const { orders, addOrder } = useOrders();
  const [products] = useState(createSeedProducts());
  const [customers] = useState(createSeedCustomers());
  const [discounts] = useState(createSeedDiscounts());
  const [convertedOrders, setConvertedOrders] = useState([]);
  const [draftOrder, setDraftOrder] = useState(() => createDraftOrderSeed(createSeedProducts(), createSeedCustomers(), createSeedDiscounts()));

  const totals = useMemo(() => calculateDraftTotals(draftOrder, discounts), [draftOrder, discounts]);
  const selectedCustomer = customers.find(customer => customer.id === draftOrder.customerId) || null;
  const selectedDiscount = discounts.find(discount => discount.id === draftOrder.discountId) || null;

  const addLineItem = () => {
    const nextProduct = products[0];
    if (!nextProduct) {
      return;
    }

    setDraftOrder(current => ({
      ...current,
      lineItems: [...current.lineItems, createDraftLineItemFromProduct(nextProduct)],
    }));
  };

  const convertToOrder = () => {
    const convertedOrder = convertDraftOrderToOrder(draftOrder, selectedCustomer, discounts, orders.length);
    addOrder(convertedOrder);
    setConvertedOrders(current => [convertedOrder, ...current]);
    setDraftOrder(createDraftOrderSeed(products, customers, discounts));
  };

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
              <h2 className={styles.title}>Products and variants</h2>
            </div>

            <div className={styles.lineItems}>
              {draftOrder.lineItems.map(item => {
                const selectedProduct = products.find(product => product.id === item.productId) || products[0];
                const selectedVariant = selectedProduct?.variants?.find(variant => variant.id === item.variantId) || selectedProduct?.variants?.[0];

                return (
                  <div key={item.id} className={styles.lineItemCard}>
                    <div className={styles.lineItemRow}>
                      <select
                        className={styles.input}
                        onChange={event => {
                          const product = products.find(entry => entry.id === event.target.value);
                          if (!product) return;
                          const nextVariant = product.variants?.[0] || null;
                          setDraftOrder(current => ({
                            ...current,
                            lineItems: current.lineItems.map(lineItem =>
                              lineItem.id === item.id
                                ? {
                                    ...lineItem,
                                    productId: product.id,
                                    variantId: nextVariant?.id || null,
                                    title: product.title,
                                    variantTitle: nextVariant?.title || 'Default',
                                    price: Number(nextVariant?.price ?? product.basePrice ?? 0),
                                  }
                                : lineItem
                            ),
                          }));
                        }}
                        value={item.productId}
                      >
                        {products.map(product => <option key={product.id} value={product.id}>{product.title}</option>)}
                      </select>

                      <select
                        className={styles.input}
                        onChange={event => {
                          const variant = selectedProduct?.variants?.find(entry => entry.id === event.target.value);
                          setDraftOrder(current => ({
                            ...current,
                            lineItems: current.lineItems.map(lineItem =>
                              lineItem.id === item.id
                                ? {
                                    ...lineItem,
                                    variantId: variant?.id || null,
                                    variantTitle: variant?.title || 'Default',
                                    price: Number(variant?.price ?? selectedProduct.basePrice ?? 0),
                                  }
                                : lineItem
                            ),
                          }));
                        }}
                        value={item.variantId || selectedVariant?.id || ''}
                      >
                        {(selectedProduct?.variants || []).map(variant => (
                          <option key={variant.id} value={variant.id}>{variant.title}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.lineItemRowCompact}>
                      <input className={styles.qtyInput} min="1" onChange={event => setDraftOrder(current => ({ ...current, lineItems: current.lineItems.map(lineItem => lineItem.id === item.id ? { ...lineItem, quantity: Number(event.target.value || 1) } : lineItem) }))} type="number" value={item.quantity} />
                      <input className={styles.input} onChange={event => setDraftOrder(current => ({ ...current, lineItems: current.lineItems.map(lineItem => lineItem.id === item.id ? { ...lineItem, price: Number(event.target.value || 0) } : lineItem) }))} type="number" value={item.price} />
                      <button className={styles.removeButton} onClick={() => setDraftOrder(current => ({ ...current, lineItems: current.lineItems.filter(lineItem => lineItem.id !== item.id) }))} type="button">Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className={styles.secondaryButton} onClick={addLineItem} type="button">Add item</button>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>Discounts, shipping, tax</p>
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
                <span>Manual discount</span>
                <input className={styles.input} onChange={event => setDraftOrder(current => ({ ...current, customDiscountAmount: Number(event.target.value || 0) }))} type="number" value={draftOrder.customDiscountAmount} />
              </label>
              <label className={styles.field}>
                <span>Shipping</span>
                <input className={styles.input} onChange={event => setDraftOrder(current => ({ ...current, shippingAmount: Number(event.target.value || 0) }))} type="number" value={draftOrder.shippingAmount} />
              </label>
              <label className={styles.field}>
                <span>Tax</span>
                <input className={styles.input} onChange={event => setDraftOrder(current => ({ ...current, taxAmount: Number(event.target.value || 0) }))} type="number" value={draftOrder.taxAmount} />
              </label>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>Payment + notes</p>
              <h2 className={styles.title}>Finalize draft</h2>
            </div>

            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>Payment status</span>
                <select className={styles.input} onChange={event => setDraftOrder(current => ({ ...current, paymentStatus: event.target.value }))} value={draftOrder.paymentStatus}>
                  <option value="pending">Payment due later</option>
                  <option value="paid">Mark as paid</option>
                </select>
              </label>
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
              <div><span>Tax</span><strong>${totals.tax.toFixed(2)}</strong></div>
              <div className={styles.totalRow}><span>Total</span><strong>${totals.total.toFixed(2)}</strong></div>
            </div>

            <div className={styles.customerSnapshot}>
              <span>Applied discount</span>
              <strong>{selectedDiscount?.title || 'No automatic discount'}</strong>
            </div>

            <div className={styles.customerSnapshot}>
              <span>Customer value</span>
              <strong>{selectedCustomer ? formatCustomerMoney(selectedCustomer.totalSpent) : '$0.00'}</strong>
            </div>

            <div className={styles.summaryActions}>
              <button className={styles.secondaryButton} type="button">Save draft</button>
              <button className={styles.primaryButton} onClick={convertToOrder} type="button">Convert to order</button>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <p className={styles.eyebrow}>Converted orders</p>
            <h2 className={styles.title}>Recent converted drafts</h2>
            <div className={styles.convertedList}>
              {convertedOrders.length ? convertedOrders.map(order => (
                <div key={order.id} className={styles.convertedRow}>
                  <div>
                    <strong>{order.orderNumber}</strong>
                    <small>{order.customer.name}</small>
                  </div>
                  <span>${order.total.toFixed(2)}</span>
                </div>
              )) : <small className={styles.emptyState}>No draft orders converted yet.</small>}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
