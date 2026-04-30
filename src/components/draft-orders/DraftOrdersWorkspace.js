"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '../AppShell';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminField from '../admin/ui/AdminField';
import AdminFormSection from '../admin/ui/AdminFormSection';
import AdminInput from '../admin/ui/AdminInput';
import AdminPage from '../admin/ui/AdminPage';
import AdminPageHeader from '../admin/ui/AdminPageHeader';
import AdminStatCard, { AdminStatsGrid } from '../admin/ui/AdminStatCard';
import AdminTextarea from '../admin/ui/AdminTextarea';
import { useOrders } from '../../context/OrdersContext';
import { useCustomers } from '../../context/CustomersContext';
import { useDiscounts } from '../../context/DiscountsContext';
import { useSettings } from '../../context/SettingsContext';
import { createSeedProducts } from '../../lib/productUtils';
import { formatCustomerMoney } from '../../lib/customersData';
import {
  calculateDraftTotals,
  convertDraftOrderToOrder,
  createDraftLineItemFromProduct,
  createDraftOrderSeed,
} from '../../lib/draftOrdersData';
import styles from './DraftOrdersWorkspace.module.css';

export default function DraftOrdersWorkspace() {
  const searchParams = useSearchParams();
  const lastNewParamRef = useRef(null);
  const { orders, addOrder } = useOrders();
  const { customers, updateCustomer } = useCustomers();
  const { discounts, updateDiscount } = useDiscounts();
  const { settings } = useSettings();
  const [products] = useState(createSeedProducts());
  const [convertedOrders, setConvertedOrders] = useState([]);
  const [draftOrder, setDraftOrder] = useState(() => createDraftOrderSeed(createSeedProducts(), customers, discounts));

  const totals = useMemo(() => calculateDraftTotals(draftOrder, discounts), [draftOrder, discounts]);
  const selectedCustomer = customers.find((customer) => customer.id === draftOrder.customerId) || null;
  const selectedDiscount = discounts.find((discount) => discount.id === draftOrder.discountId) || null;
  const newParam = searchParams.get('new');

  useEffect(() => {
    if (newParam === '1' && lastNewParamRef.current !== '1') {
      setDraftOrder(createDraftOrderSeed(products, customers, discounts));
    }
    lastNewParamRef.current = newParam;
  }, [customers, discounts, newParam, products]);

  const addLineItem = () => {
    const nextProduct = products[0];
    if (!nextProduct) return;

    setDraftOrder((current) => ({
      ...current,
      lineItems: [...current.lineItems, createDraftLineItemFromProduct(nextProduct)],
    }));
  };

  const convertToOrder = () => {
    const convertedOrder = {
      ...convertDraftOrderToOrder(draftOrder, selectedCustomer, discounts, orders.length),
      orderNumber: `#${settings.orderPrefix}${String(orders.length + 1).padStart(4, '0')}`,
      location: settings.defaultLocation,
      shippingAddress: selectedCustomer?.defaultAddress || settings.shippingOrigin,
      billingAddress: selectedCustomer?.defaultAddress || settings.shippingOrigin,
    };

    addOrder(convertedOrder);
    setConvertedOrders((current) => [convertedOrder, ...current]);

    if (selectedCustomer) {
      updateCustomer(selectedCustomer.id, (customer) => ({
        ...customer,
        totalSpent: Number(customer.totalSpent || 0) + convertedOrder.total,
        orderCount: Number(customer.orderCount || 0) + 1,
        lastOrderDate: convertedOrder.createdAt,
        recentOrders: [convertedOrder.orderNumber, ...(customer.recentOrders || [])].slice(0, 5),
      }));
    }

    if (draftOrder.discountId) {
      updateDiscount(draftOrder.discountId, (discount) => ({
        ...discount,
        usageCount: Number(discount.usageCount || 0) + 1,
      }));
    }

    setDraftOrder(createDraftOrderSeed(products, customers, discounts));
  };

  return (
    <AppShell>
      <AdminPage>
        <AdminPageHeader
          description="Build server-priced order drafts before converting to a live order."
          eyebrow="Draft orders"
          title="Create draft order"
          actions={<AdminButton onClick={() => setDraftOrder(createDraftOrderSeed(products, customers, discounts))} size="sm" variant="secondary">New draft</AdminButton>}
        />

        <AdminStatsGrid>
          <AdminStatCard label="Subtotal" value={`$${totals.subtotal.toFixed(2)}`} />
          <AdminStatCard label="Discount" value={`-$${totals.discountAmount.toFixed(2)}`} />
          <AdminStatCard label="Shipping + tax" value={`$${(totals.shipping + totals.tax).toFixed(2)}`} />
          <AdminStatCard label="Total" value={`$${totals.total.toFixed(2)}`} />
        </AdminStatsGrid>

        <div className={styles.layout}>
          <div className={styles.mainColumn}>
            <AdminFormSection eyebrow="Customer" title="Who is this for?">
              <AdminField label="Customer">
                <select onChange={(event) => setDraftOrder((current) => ({ ...current, customerId: event.target.value }))} value={draftOrder.customerId}>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </AdminField>
            </AdminFormSection>

            <AdminFormSection eyebrow="Line items" title="Products and variants">
              <div className={styles.lineItems}>
                {draftOrder.lineItems.map((item) => {
                  const selectedProduct = products.find((product) => product.id === item.productId) || products[0];
                  const selectedVariant = selectedProduct?.variants?.find((variant) => variant.id === item.variantId) || selectedProduct?.variants?.[0];

                  return (
                    <AdminCard className={styles.lineItem} key={item.id} variant="inset">
                      <div className={styles.rowTwo}>
                        <select
                          onChange={(event) => {
                            const product = products.find((entry) => entry.id === event.target.value);
                            if (!product) return;
                            const nextVariant = product.variants?.[0] || null;
                            setDraftOrder((current) => ({
                              ...current,
                              lineItems: current.lineItems.map((lineItem) =>
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
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>{product.title}</option>
                          ))}
                        </select>

                        <select
                          onChange={(event) => {
                            const variant = selectedProduct?.variants?.find((entry) => entry.id === event.target.value);
                            setDraftOrder((current) => ({
                              ...current,
                              lineItems: current.lineItems.map((lineItem) =>
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
                          {(selectedProduct?.variants || []).map((variant) => (
                            <option key={variant.id} value={variant.id}>{variant.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.rowThree}>
                        <AdminInput
                          min="1"
                          onChange={(event) =>
                            setDraftOrder((current) => ({
                              ...current,
                              lineItems: current.lineItems.map((lineItem) =>
                                lineItem.id === item.id
                                  ? { ...lineItem, quantity: Number(event.target.value || 1) }
                                  : lineItem
                              ),
                            }))
                          }
                          type="number"
                          value={item.quantity}
                        />
                        <AdminInput
                          onChange={(event) =>
                            setDraftOrder((current) => ({
                              ...current,
                              lineItems: current.lineItems.map((lineItem) =>
                                lineItem.id === item.id
                                  ? { ...lineItem, price: Number(event.target.value || 0) }
                                  : lineItem
                              ),
                            }))
                          }
                          type="number"
                          value={item.price}
                        />
                        <AdminButton
                          onClick={() =>
                            setDraftOrder((current) => ({
                              ...current,
                              lineItems: current.lineItems.filter((lineItem) => lineItem.id !== item.id),
                            }))
                          }
                          size="sm"
                          variant="danger"
                        >
                          Remove
                        </AdminButton>
                      </div>
                    </AdminCard>
                  );
                })}
              </div>

              <AdminButton onClick={addLineItem} size="sm" variant="secondary">Add item</AdminButton>
            </AdminFormSection>

            <AdminFormSection eyebrow="Pricing" title="Discounts, shipping, and tax">
              <div className={styles.gridTwo}>
                <AdminField label="Discount">
                  <select onChange={(event) => setDraftOrder((current) => ({ ...current, discountId: event.target.value }))} value={draftOrder.discountId}>
                    <option value="">No discount</option>
                    {discounts.map((discount) => (
                      <option key={discount.id} value={discount.id}>{discount.title}</option>
                    ))}
                  </select>
                </AdminField>
                <AdminField label="Manual discount">
                  <AdminInput onChange={(event) => setDraftOrder((current) => ({ ...current, customDiscountAmount: Number(event.target.value || 0) }))} type="number" value={draftOrder.customDiscountAmount} />
                </AdminField>
                <AdminField label="Shipping">
                  <AdminInput onChange={(event) => setDraftOrder((current) => ({ ...current, shippingAmount: Number(event.target.value || 0) }))} placeholder={`Free over $${settings.freeShippingThreshold}`} type="number" value={draftOrder.shippingAmount} />
                </AdminField>
                <AdminField label="Tax">
                  <AdminInput onChange={(event) => setDraftOrder((current) => ({ ...current, taxAmount: Number(event.target.value || 0) }))} type="number" value={draftOrder.taxAmount} />
                </AdminField>
              </div>
            </AdminFormSection>

            <AdminFormSection eyebrow="Payment" title="Finalize draft">
              <AdminField label="Payment status">
                <select onChange={(event) => setDraftOrder((current) => ({ ...current, paymentStatus: event.target.value }))} value={draftOrder.paymentStatus}>
                  <option value="pending">Payment due later</option>
                  <option value="paid">Mark as paid</option>
                </select>
              </AdminField>
              <AdminField label="Internal notes">
                <AdminTextarea
                  onChange={(event) => setDraftOrder((current) => ({ ...current, notes: event.target.value }))}
                  rows={5}
                  value={draftOrder.notes}
                />
              </AdminField>
            </AdminFormSection>
          </div>

          <div className={styles.sideColumn}>
            <AdminCard className={styles.summaryCard} variant="panel">
              <p className={styles.summaryTitle}>Draft summary</p>
              <div className={styles.summaryRows}>
                <div><span>Customer</span><strong>{selectedCustomer?.name || 'No customer selected'}</strong></div>
                <div><span>Subtotal</span><strong>${totals.subtotal.toFixed(2)}</strong></div>
                <div><span>Discount</span><strong>- ${totals.discountAmount.toFixed(2)}</strong></div>
                <div><span>Shipping</span><strong>${totals.shipping.toFixed(2)}</strong></div>
                <div><span>Tax</span><strong>${totals.tax.toFixed(2)}</strong></div>
                <div className={styles.totalRow}><span>Total</span><strong>${totals.total.toFixed(2)}</strong></div>
              </div>

              <div className={styles.summaryMeta}>
                <small>Applied discount: {selectedDiscount?.title || 'None'}</small>
                <small>Customer value: {selectedCustomer ? formatCustomerMoney(selectedCustomer.totalSpent) : '$0.00'}</small>
              </div>

              <div className={styles.summaryActions}>
                <AdminButton size="sm" variant="secondary">Save draft</AdminButton>
                <AdminButton onClick={convertToOrder} size="sm" variant="primary">Convert to order</AdminButton>
              </div>
            </AdminCard>

            <AdminCard className={styles.summaryCard} variant="card">
              <p className={styles.summaryTitle}>Recent converted drafts</p>
              <div className={styles.convertedList}>
                {convertedOrders.length
                  ? convertedOrders.map((order) => (
                      <div className={styles.convertedRow} key={order.id}>
                        <div>
                          <strong>{order.orderNumber}</strong>
                          <small>{order.customer.name}</small>
                        </div>
                        <span>${order.total.toFixed(2)}</span>
                      </div>
                    ))
                  : <small className={styles.emptyState}>No draft orders converted yet.</small>}
              </div>
            </AdminCard>
          </div>
        </div>
      </AdminPage>
    </AppShell>
  );
}
