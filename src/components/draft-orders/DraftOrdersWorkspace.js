"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import AppShell from '../AppShell';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminField from '../admin/ui/AdminField';
import AdminFormSection from '../admin/ui/AdminFormSection';
import AdminInput from '../admin/ui/AdminInput';
import AdminPage from '../admin/ui/AdminPage';
import AdminPageHeader from '../admin/ui/AdminPageHeader';
import AdminSelect from '../admin/ui/AdminSelect';
import AdminStatCard, { AdminStatsGrid } from '../admin/ui/AdminStatCard';
import AdminTextarea from '../admin/ui/AdminTextarea';
import { useCustomers } from '../../context/CustomersContext';
import { useDiscounts } from '../../context/DiscountsContext';
import { useProducts } from '../../context/ProductsContext';
import { useSettings } from '../../context/SettingsContext';
import { formatCustomerMoney } from '../../lib/customersData';
import {
  calculateDraftTotals,
  createDraftLineItemFromProduct,
  createDraftOrderSeed,
  resolveDraftLineItemDisplay,
  validateManualDraftCustomer,
} from '../../lib/draftOrdersData';
import styles from './DraftOrdersWorkspace.module.css';

export default function DraftOrdersWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastNewParamRef = useRef(null);
  const { customers, updateCustomer, createCustomer } = useCustomers();
  const { discounts, updateDiscount } = useDiscounts();
  const { products, loading: productsLoading } = useProducts();
  const { settings } = useSettings();
  const [convertedOrders, setConvertedOrders] = useState([]);
  const [customerError, setCustomerError] = useState('');
  const [customerNotice, setCustomerNotice] = useState('');
  const [converting, setConverting] = useState(false);
  const [draftOrder, setDraftOrder] = useState(() => createDraftOrderSeed([], customers, discounts));
  const availableProducts = useMemo(() => products, [products]);

  const totals = useMemo(
    () => calculateDraftTotals(draftOrder, discounts, settings),
    [draftOrder, discounts, settings]
  );
  const selectedCustomer = customers.find((customer) => customer.id === draftOrder.customerId) || null;
  const selectedDiscount = discounts.find((discount) => discount.id === draftOrder.discountId) || null;
  const newParam = searchParams.get('new');

  useEffect(() => {
    if (newParam === '1' && lastNewParamRef.current !== '1') {
      setDraftOrder(createDraftOrderSeed(availableProducts, customers, discounts));
    }
    lastNewParamRef.current = newParam;
  }, [availableProducts, customers, discounts, newParam]);

  const addLineItem = () => {
    const nextProduct = availableProducts[0];
    if (!nextProduct) return;

    setDraftOrder((current) => ({
      ...current,
      lineItems: [...current.lineItems, createDraftLineItemFromProduct(nextProduct)],
    }));
  };

  const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;

  const convertToOrder = async () => {
    setCustomerError('');
    setCustomerNotice('');
    setConverting(true);

    let resolvedCustomer = selectedCustomer;

    if (draftOrder.customerMode === 'manual') {
      const manualValidation = validateManualDraftCustomer(draftOrder.manualCustomer);
      if (!manualValidation.isValid) {
        setCustomerError(manualValidation.errors.email || 'Manual customer details are invalid.');
        setConverting(false);
        return;
      }

      try {
        const result = await createCustomer({
          ...manualValidation.normalized,
          note: 'Created from draft order',
        });
        resolvedCustomer = result.customer;
        setDraftOrder((current) => ({
          ...current,
          customerId: result.customer.id,
        }));
        if (result.duplicate) {
          setCustomerNotice('An existing customer with this email was selected.');
        } else {
          setCustomerNotice('Manual customer created and attached to this draft.');
        }
      } catch (creationError) {
        setCustomerError(
          creationError instanceof Error ? creationError.message : 'Failed to create manual customer.'
        );
        setConverting(false);
        return;
      }
    }

    if (draftOrder.customerMode === 'existing' && !resolvedCustomer) {
      setCustomerError('Select a customer, switch to guest checkout, or create one manually.');
      setConverting(false);
      return;
    }

    const invalidPriceOverride = draftOrder.lineItems.find((lineItem) => {
      const display = resolveDraftLineItemDisplay(lineItem, availableProducts);
      if (!display.priceOverridden) return false;
      if (display.priceOverrideAmount == null) return true;
      if (!Number.isFinite(Number(display.priceOverrideAmount)) || Number(display.priceOverrideAmount) < 0) {
        return true;
      }
      return !String(display.priceOverrideReason || '').trim();
    });

    if (invalidPriceOverride) {
      setCustomerError('Every overridden line price needs a non-negative amount and an override reason.');
      setConverting(false);
      return;
    }

    const customerForOrder = draftOrder.customerMode === 'guest' ? null : resolvedCustomer;
    const payload = {
      draftId: String(draftOrder.id || ''),
      customerId: customerForOrder?.id || undefined,
      email: customerForOrder?.email || undefined,
      notes: draftOrder.notes || undefined,
      paymentStatus: draftOrder.paymentStatus === 'paid' ? 'paid' : 'pending',
      shippingAmount:
        draftOrder.shippingAmount == null || draftOrder.shippingAmount === ''
          ? totals.shipping
          : Number(draftOrder.shippingAmount),
      taxAmount:
        draftOrder.taxAmount == null || draftOrder.taxAmount === ''
          ? totals.tax
          : Number(draftOrder.taxAmount),
      discountAmount: totals.discountAmount,
      shippingAddress:
        draftOrder.customerMode === 'manual'
          ? draftOrder.manualCustomer.shippingAddress || customerForOrder?.defaultAddress || settings.shippingOrigin
          : customerForOrder?.defaultAddress || settings.shippingOrigin,
      billingAddress:
        draftOrder.customerMode === 'manual'
          ? draftOrder.manualCustomer.billingAddress || customerForOrder?.defaultAddress || settings.shippingOrigin
          : customerForOrder?.defaultAddress || settings.shippingOrigin,
      lineItems: draftOrder.lineItems.map((item) => {
        const display = resolveDraftLineItemDisplay(item, availableProducts);
        return {
          productId: item.productId || null,
          variantId: item.variantId || null,
          title: item.title,
          variantTitle: item.variantTitle || null,
          sku: item.sku || null,
          quantity: Number(item.quantity || 1),
          originalPrice: Number(display.originalPrice || 0),
          unitPrice: Number(display.unitPrice || 0),
          priceOverridden: Boolean(display.priceOverridden),
          priceOverrideAmount:
            display.priceOverrideAmount == null ? null : Number(display.priceOverrideAmount),
          priceOverrideReason: String(display.priceOverrideReason || ''),
        };
      }),
    };

    let conversionResult = null;
    try {
      const response = await fetch('/api/draft-orders/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json();
      if (!json?.success) {
        throw new Error(json?.error || 'Failed to convert draft order.');
      }

      conversionResult = json.data;
    } catch (conversionError) {
      setCustomerError(
        conversionError instanceof Error ? conversionError.message : 'Failed to convert draft order.'
      );
      setConverting(false);
      return;
    }

    if (customerForOrder) {
      const convertedOrderNumber = `#${conversionResult.orderNumber}`;
      updateCustomer(customerForOrder.id, (customer) => ({
        ...customer,
        totalSpent: Number(customer.totalSpent || 0) + totals.total,
        orderCount: Number(customer.orderCount || 0) + 1,
        lastOrderDate: new Date().toISOString(),
        recentOrders: [convertedOrderNumber, ...(customer.recentOrders || [])].slice(0, 5),
      }));
    }

    if (draftOrder.discountId) {
      updateDiscount(draftOrder.discountId, (discount) => ({
        ...discount,
        usageCount: Number(discount.usageCount || 0) + 1,
      }));
    }

    setConvertedOrders((current) => [
      {
        id: conversionResult.orderId,
        orderNumber: `#${conversionResult.orderNumber}`,
        customer: {
          name: customerForOrder?.name || 'Guest Customer',
        },
        total: totals.total,
      },
      ...current,
    ]);
    setDraftOrder(createDraftOrderSeed(availableProducts, customers, discounts));
    setConverting(false);
    router.push(String(conversionResult.redirectUrl || `/orders/${conversionResult.orderNumber}`));
  };

  return (
    <AppShell>
      <AdminPage>
        <AdminPageHeader
          description="Build server-priced order drafts before converting to a live order."
          eyebrow="Draft orders"
          title="Create draft order"
          actions={<AdminButton onClick={() => setDraftOrder(createDraftOrderSeed(availableProducts, customers, discounts))} size="sm" variant="secondary">New draft</AdminButton>}
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
              <AdminField label="Checkout customer mode">
                <AdminSelect
                  onChange={(value) =>
                    setDraftOrder((current) => ({
                      ...current,
                      customerMode: value,
                    }))
                  }
                  options={[
                    { value: 'existing', label: 'Use existing customer' },
                    { value: 'manual', label: 'Create customer manually' },
                    { value: 'guest', label: 'Guest / no customer' },
                  ]}
                  value={draftOrder.customerMode || 'existing'}
                />
              </AdminField>

              {customerError ? <p className={styles.inlineError}>{customerError}</p> : null}
              {customerNotice ? <p className={styles.inlineNotice}>{customerNotice}</p> : null}

              {draftOrder.customerMode === 'existing' ? (
              <AdminField label="Customer">
                <AdminSelect
                  onChange={(value) =>
                    setDraftOrder((current) => ({ ...current, customerId: value }))
                  }
                  options={[
                    { value: '', label: 'Select customer' },
                    ...customers.map((customer) => ({ value: customer.id, label: customer.name })),
                  ]}
                  value={draftOrder.customerId}
                />
              </AdminField>
              ) : null}

              {draftOrder.customerMode === 'manual' ? (
                <div className={styles.gridTwo}>
                  <AdminField label="First name">
                    <AdminInput
                      onChange={(event) =>
                        setDraftOrder((current) => ({
                          ...current,
                          manualCustomer: {
                            ...current.manualCustomer,
                            firstName: event.target.value,
                          },
                        }))
                      }
                      type="text"
                      value={draftOrder.manualCustomer?.firstName || ''}
                    />
                  </AdminField>
                  <AdminField label="Last name">
                    <AdminInput
                      onChange={(event) =>
                        setDraftOrder((current) => ({
                          ...current,
                          manualCustomer: {
                            ...current.manualCustomer,
                            lastName: event.target.value,
                          },
                        }))
                      }
                      type="text"
                      value={draftOrder.manualCustomer?.lastName || ''}
                    />
                  </AdminField>
                  <AdminField label="Email">
                    <AdminInput
                      onChange={(event) =>
                        setDraftOrder((current) => ({
                          ...current,
                          manualCustomer: {
                            ...current.manualCustomer,
                            email: event.target.value,
                          },
                        }))
                      }
                      type="email"
                      value={draftOrder.manualCustomer?.email || ''}
                    />
                  </AdminField>
                  <AdminField label="Phone (optional)">
                    <AdminInput
                      onChange={(event) =>
                        setDraftOrder((current) => ({
                          ...current,
                          manualCustomer: {
                            ...current.manualCustomer,
                            phone: event.target.value,
                          },
                        }))
                      }
                      type="text"
                      value={draftOrder.manualCustomer?.phone || ''}
                    />
                  </AdminField>
                  <AdminField label="Shipping address (optional)">
                    <AdminInput
                      onChange={(event) =>
                        setDraftOrder((current) => ({
                          ...current,
                          manualCustomer: {
                            ...current.manualCustomer,
                            shippingAddress: event.target.value,
                          },
                        }))
                      }
                      type="text"
                      value={draftOrder.manualCustomer?.shippingAddress || ''}
                    />
                  </AdminField>
                  <AdminField label="Billing address (optional)">
                    <AdminInput
                      onChange={(event) =>
                        setDraftOrder((current) => ({
                          ...current,
                          manualCustomer: {
                            ...current.manualCustomer,
                            billingAddress: event.target.value,
                          },
                        }))
                      }
                      type="text"
                      value={draftOrder.manualCustomer?.billingAddress || ''}
                    />
                  </AdminField>
                </div>
              ) : null}

              {draftOrder.customerMode === 'guest' ? (
                <p className={styles.inlineHint}>Guest mode keeps this draft unattached to any customer profile.</p>
              ) : null}
            </AdminFormSection>

            <AdminFormSection eyebrow="Line items" title="Products and variants">
              <div className={styles.lineItems}>
                {draftOrder.lineItems.map((item) => {
                  const display = resolveDraftLineItemDisplay(item, availableProducts);
                  const selectedProduct = display.product;
                  const selectedVariant = display.variant;
                  const productSelectValue = selectedProduct ? selectedProduct.id : `snapshot:${item.id}`;
                  const productOptions = [
                    ...(selectedProduct
                      ? []
                      : [{ value: `snapshot:${item.id}`, label: `Snapshot only: ${display.title}` }]),
                    ...availableProducts.map((product) => ({ value: product.id, label: product.title })),
                  ];
                  const variantSelectValue = selectedVariant?.id || `snapshot:${item.id}`;
                  const variantOptions = [
                    ...(selectedVariant
                      ? []
                      : [{ value: `snapshot:${item.id}`, label: `Snapshot only: ${display.variantTitle}` }]),
                    ...((selectedProduct?.variants || []).map((variant) => ({
                      value: variant.id,
                      label: variant.title,
                    }))),
                  ];

                  return (
                    <AdminCard className={styles.lineItem} key={item.id} variant="inset">
                      <div className={styles.snapshotMeta}>
                        {display.imageUrl ? (
                          <img
                            alt={display.imageAlt || display.title}
                            className={styles.snapshotThumb}
                            src={display.imageUrl}
                          />
                        ) : null}
                        <div className={styles.snapshotText}>
                          <strong>{display.title}</strong>
                          <small>{display.variantTitle}</small>
                          <small>{display.sku ? `SKU ${display.sku}` : 'SKU not set'}</small>
                          {display.productMissing ? (
                            <small className={styles.snapshotWarning}>Product missing in current catalog. Using snapshot values.</small>
                          ) : null}
                        </div>
                      </div>

                      <div className={styles.rowTwo}>
                        <AdminField label="Product">
                          <AdminSelect
                            onChange={(value) => {
                              if (value.startsWith('snapshot:')) return;
                              const product = availableProducts.find((entry) => entry.id === value);
                              if (!product) return;
                              const nextVariant = product.variants?.[0] || null;
                              const nextSnapshot = createDraftLineItemFromProduct(product, nextVariant?.id || null);
                              setDraftOrder((current) => ({
                                ...current,
                                lineItems: current.lineItems.map((lineItem) =>
                                  lineItem.id === item.id
                                    ? {
                                        ...lineItem,
                                        ...nextSnapshot,
                                        id: lineItem.id,
                                        quantity: lineItem.quantity,
                                      }
                                    : lineItem
                                ),
                              }));
                            }}
                            options={productOptions}
                            value={productSelectValue}
                          />
                        </AdminField>

                        <AdminField label="Variant">
                          <AdminSelect
                            onChange={(value) => {
                              if (value.startsWith('snapshot:')) return;
                              const variant = selectedProduct?.variants?.find((entry) => entry.id === value);
                              const nextSnapshot = createDraftLineItemFromProduct(selectedProduct, variant?.id || null);
                              setDraftOrder((current) => ({
                                ...current,
                                lineItems: current.lineItems.map((lineItem) =>
                                  lineItem.id === item.id
                                    ? {
                                        ...lineItem,
                                        ...nextSnapshot,
                                        id: lineItem.id,
                                        quantity: lineItem.quantity,
                                      }
                                    : lineItem
                                ),
                              }));
                            }}
                            options={variantOptions}
                            value={variantSelectValue}
                          />
                        </AdminField>
                      </div>

                      <div className={styles.lineControls}>
                        <AdminField label="Quantity">
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
                            value={display.quantity}
                          />
                        </AdminField>

                        <AdminField label="Unit price">
                          {display.priceOverridden ? (
                            <AdminInput
                              min="0"
                              onChange={(event) =>
                                setDraftOrder((current) => ({
                                  ...current,
                                  lineItems: current.lineItems.map((lineItem) =>
                                    lineItem.id === item.id
                                      ? {
                                          ...lineItem,
                                          priceOverrideAmount:
                                            event.target.value === '' ? null : Number(event.target.value || 0),
                                        }
                                      : lineItem
                                  ),
                                }))
                              }
                              step="0.01"
                              type="number"
                              value={display.priceOverrideAmount ?? ''}
                            />
                          ) : (
                            <p className={styles.readOnlyValue}>{formatMoney(display.unitPrice)}</p>
                          )}
                          <small className={styles.inlineHint}>Catalog: {formatMoney(display.originalPrice)}</small>
                          <AdminButton
                            onClick={() =>
                              setDraftOrder((current) => ({
                                ...current,
                                lineItems: current.lineItems.map((lineItem) =>
                                  lineItem.id === item.id
                                    ? {
                                        ...lineItem,
                                        priceOverridden: !display.priceOverridden,
                                        priceOverrideAmount: display.priceOverridden ? null : display.originalPrice,
                                        priceOverrideReason: display.priceOverridden ? '' : lineItem.priceOverrideReason || '',
                                      }
                                    : lineItem
                                ),
                              }))
                            }
                            size="sm"
                            variant="secondary"
                          >
                            {display.priceOverridden ? 'Use catalog price' : 'Override price'}
                          </AdminButton>
                        </AdminField>

                        <AdminField label="Line total">
                          <p className={styles.readOnlyValue}>{formatMoney(display.unitPrice * display.quantity)}</p>
                        </AdminField>

                        <div className={styles.removeWrap}>
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
                      </div>

                      {display.priceOverridden ? (
                        <AdminField label="Override reason">
                          <AdminInput
                            onChange={(event) =>
                              setDraftOrder((current) => ({
                                ...current,
                                lineItems: current.lineItems.map((lineItem) =>
                                  lineItem.id === item.id
                                    ? { ...lineItem, priceOverrideReason: event.target.value }
                                    : lineItem
                                ),
                              }))
                            }
                            placeholder="Explain why this line price is overridden"
                            type="text"
                            value={display.priceOverrideReason}
                          />
                        </AdminField>
                      ) : null}
                    </AdminCard>
                  );
                })}
              </div>

              <AdminButton disabled={productsLoading || !availableProducts.length} onClick={addLineItem} size="sm" variant="secondary">
                {productsLoading ? 'Loading catalog...' : 'Add item'}
              </AdminButton>
            </AdminFormSection>

            <AdminFormSection eyebrow="Pricing" title="Discounts, shipping, and tax">
              <div className={styles.gridTwo}>
                <AdminField label="Discount">
                  <AdminSelect
                    onChange={(value) => setDraftOrder((current) => ({ ...current, discountId: value }))}
                    options={[
                      { value: '', label: 'No discount' },
                      ...discounts.map((discount) => ({ value: discount.id, label: discount.title })),
                    ]}
                    value={draftOrder.discountId}
                  />
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
                <AdminSelect
                  onChange={(value) => setDraftOrder((current) => ({ ...current, paymentStatus: value }))}
                  options={[
                    { value: 'pending', label: 'Payment due later' },
                    { value: 'paid', label: 'Mark as paid' },
                  ]}
                  value={draftOrder.paymentStatus}
                />
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
                <small>
                  Customer value: {selectedCustomer ? formatCustomerMoney(selectedCustomer.totalSpent) : '$0.00'}
                </small>
              </div>

              <div className={styles.summaryActions}>
                <AdminButton disabled size="sm" variant="secondary">Save draft (not available yet)</AdminButton>
                <AdminButton loading={converting} onClick={convertToOrder} size="sm" variant="primary">
                  Create and convert draft
                </AdminButton>
              </div>
              <small className={styles.inlineHint}>This flow currently supports creating and converting drafts in one session.</small>
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
