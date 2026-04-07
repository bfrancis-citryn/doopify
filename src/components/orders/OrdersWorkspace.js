"use client";

import { useMemo, useState } from 'react';
import AppShell from '../AppShell';
import { useOrders } from '../../context/OrdersContext';
import { useSettings } from '../../context/SettingsContext';
import {
  ORDER_DELIVERY_STATUSES,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_PAYMENT_STATUSES,
  ORDER_RETURN_STATUSES,
  ORDER_VIEWS,
  formatOrderMoney,
  getOrderViewMatch,
  searchOrder,
  summarizeOrders,
} from '../../lib/ordersData';
import styles from './OrdersWorkspace.module.css';

function StatusPill({ children, tone }) {
  return <span className={`${styles.statusPill} ${styles[`tone_${tone}`]}`}>{children}</span>;
}

function BulkActionsBar({ selectedCount, onAction }) {
  if (!selectedCount) {
    return null;
  }

  return (
    <div className={styles.bulkBar}>
      <span>{selectedCount} selected</span>
      <div className={styles.bulkActions}>
        <button className={styles.bulkActionButton} onClick={() => onAction('fulfilled')} type="button">Mark fulfilled</button>
        <button className={styles.bulkActionButton} onClick={() => onAction('packed')} type="button">Mark packed</button>
        <button className={styles.bulkActionButton} onClick={() => onAction('tag-priority')} type="button">Add priority tag</button>
        <button className={styles.bulkActionButton} onClick={() => onAction('archive')} type="button">Archive</button>
      </div>
    </div>
  );
}

export default function OrdersWorkspace() {
  const { orders, setOrders, updateOrder } = useOrders();
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [tagInput, setTagInput] = useState('');
  const [shippingLabelDraft, setShippingLabelDraft] = useState({ packageType: 'Small box', carrierService: 'UPS Ground', weight: '1.0 lb' });

  const visibleOrders = useMemo(
    () =>
      orders.filter(order => {
        const baseMatch = getOrderViewMatch(order, activeView) && searchOrder(order, searchQuery);
        const paymentMatch = paymentFilter === 'all' || order.paymentStatus === paymentFilter;
        const fulfillmentMatch = fulfillmentFilter === 'all' || order.fulfillmentStatus === fulfillmentFilter;
        const deliveryMatch = deliveryFilter === 'all' || order.deliveryStatus === deliveryFilter;
        return baseMatch && paymentMatch && fulfillmentMatch && deliveryMatch;
      }),
    [activeView, deliveryFilter, fulfillmentFilter, orders, paymentFilter, searchQuery]
  );

  const selectedOrder =
    visibleOrders.find(order => order.id === selectedOrderId) ||
    orders.find(order => order.id === selectedOrderId) ||
    visibleOrders[0] ||
    null;
  const summary = summarizeOrders(visibleOrders);

  const appendTimeline = (order, event, detail) => ({
    ...order,
    timeline: [
      {
        id: `${event}-${Date.now()}`,
        event,
        detail,
        createdAt: new Date().toISOString(),
      },
      ...(order.timeline || []),
    ],
  });

  const handleBulkAction = action => {
    setOrders(currentOrders =>
      currentOrders.map(order => {
        if (!selectedIds.includes(order.id)) {
          return order;
        }

        if (action === 'fulfilled') {
          return appendTimeline(
            {
              ...order,
              fulfillmentStatus: 'fulfilled',
              deliveryStatus: order.deliveryStatus === 'not-shipped' ? 'in-transit' : order.deliveryStatus,
            },
            'Fulfillment updated',
            'Bulk action: marked fulfilled.'
          );
        }

        if (action === 'packed') {
          return appendTimeline(
            {
              ...order,
              fulfillmentStatus: 'packed',
            },
            'Packing updated',
            'Bulk action: marked packed.'
          );
        }

        if (action === 'tag-priority') {
          return {
            ...order,
            tags: [...new Set([...(order.tags || []), 'Priority'])],
          };
        }

        if (action === 'archive') {
          return {
            ...order,
            tags: [...new Set([...(order.tags || []), 'Archived'])],
          };
        }

        return order;
      })
    );
    setSelectedIds([]);
  };

  const toggleSelectedRow = orderId => {
    setSelectedIds(current => (current.includes(orderId) ? current.filter(id => id !== orderId) : [...current, orderId]));
  };

  const toggleSelectAllVisible = checked => {
    setSelectedIds(checked ? visibleOrders.map(order => order.id) : []);
  };

  const addTagToOrder = () => {
    const normalizedTag = tagInput.trim();
    if (!selectedOrder || !normalizedTag) {
      return;
    }

    updateOrder(selectedOrder.id, order => ({
      ...order,
      tags: [...new Set([...(order.tags || []), normalizedTag])],
    }));
    setTagInput('');
  };

  const buyShippingLabel = () => {
    if (!selectedOrder) {
      return;
    }

    updateOrder(selectedOrder.id, order =>
      appendTimeline(
        {
          ...order,
          trackingNumber: order.trackingNumber || `LBL-${order.orderNumber.replace('#', '')}`,
          carrier: shippingLabelDraft.carrierService,
          deliveryStatus: order.deliveryStatus === 'not-shipped' ? 'in-transit' : order.deliveryStatus,
          fulfillmentStatus: order.fulfillmentStatus === 'unfulfilled' ? 'packed' : order.fulfillmentStatus,
        },
        'Shipping label purchased',
        `${shippingLabelDraft.carrierService} label created for ${shippingLabelDraft.packageType} (${shippingLabelDraft.weight}).`
      )
    );
  };

  return (
    <AppShell
      onCreateOrder={() => {}}
      onNotificationsClick={() => {}}
      onQuickActionClick={() => {}}
      onSearchChange={event => setSearchQuery(event.target.value)}
      searchValue={searchQuery}
    >
      <div className={styles.ordersPage}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}><span>Orders</span><strong>{summary.orders}</strong></div>
          <div className={styles.summaryCard}><span>Items ordered</span><strong>{summary.itemsOrdered}</strong></div>
          <div className={styles.summaryCard}><span>Returns</span><strong>{summary.returns}</strong></div>
          <div className={styles.summaryCard}><span>Orders fulfilled</span><strong>{summary.fulfilled}</strong></div>
          <div className={styles.summaryCard}><span>Orders delivered</span><strong>{summary.delivered}</strong></div>
          <div className={styles.summaryCard}><span>To fulfillment</span><strong>{summary.toFulfill}</strong></div>
        </div>

        <div className={styles.viewBar}>
          {ORDER_VIEWS.map(view => (
            <button key={view.id} className={activeView === view.id ? styles.viewButtonActive : styles.viewButton} onClick={() => setActiveView(view.id)} type="button">
              {view.label}
            </button>
          ))}
        </div>

        <div className={styles.filterToolbar}>
          <select className={styles.filterSelect} onChange={event => setPaymentFilter(event.target.value)} value={paymentFilter}>
            <option value="all">All payments</option>
            {ORDER_PAYMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
          <select className={styles.filterSelect} onChange={event => setFulfillmentFilter(event.target.value)} value={fulfillmentFilter}>
            <option value="all">All fulfillment</option>
            {ORDER_FULFILLMENT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
          <select className={styles.filterSelect} onChange={event => setDeliveryFilter(event.target.value)} value={deliveryFilter}>
            <option value="all">All delivery</option>
            {ORDER_DELIVERY_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>

        <BulkActionsBar onAction={handleBulkAction} selectedCount={selectedIds.length} />

        <div className={styles.ordersLayout}>
          <div className={styles.ordersTableWrap}>
            <div className={styles.tableHeader}>
              <span><input checked={visibleOrders.length > 0 && selectedIds.length === visibleOrders.length} onChange={event => toggleSelectAllVisible(event.target.checked)} type="checkbox" /></span>
              <span>Order</span>
              <span>Date</span>
              <span>Customer</span>
              <span>Payment</span>
              <span>Fulfillment</span>
              <span>Delivery</span>
              <span>Total</span>
            </div>

            <div className={styles.tableBody}>
              {visibleOrders.map(order => (
                <div key={order.id} className={selectedOrder?.id === order.id ? styles.orderRowActive : styles.orderRow}>
                  <div className={styles.checkboxCell}>
                    <input checked={selectedIds.includes(order.id)} onChange={() => toggleSelectedRow(order.id)} type="checkbox" />
                  </div>
                  <button className={styles.rowButton} onClick={() => setSelectedOrderId(order.id)} type="button">
                    <div className={styles.orderNumberCell}>
                      <strong>{order.orderNumber}</strong>
                      <small>{order.channel}</small>
                    </div>
                    <div>{new Date(order.createdAt).toLocaleDateString()}</div>
                    <div className={styles.customerCell}>
                      <strong>{order.customer.name}</strong>
                      <small>{order.customer.email}</small>
                    </div>
                    <div><StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill></div>
                    <div><StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill></div>
                    <div><StatusPill tone={order.deliveryStatus.replace(/\s+/g, '-')}>{order.deliveryStatus}</StatusPill></div>
                    <div>{formatOrderMoney(order.total)}</div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.orderDetailPane}>
            {selectedOrder ? (
              <div className={styles.shopifyOrderShell}>
                <div className={styles.shopifyOrderHeader}>
                  <div>
                    <div className={styles.shopifyOrderTitleRow}>
                      <h2 className={styles.detailTitle}>{selectedOrder.orderNumber}</h2>
                      <StatusPill tone={selectedOrder.paymentStatus.replace(/\s+/g, '-')}>{selectedOrder.paymentStatus}</StatusPill>
                      <StatusPill tone={selectedOrder.fulfillmentStatus.replace(/\s+/g, '-')}>{selectedOrder.fulfillmentStatus}</StatusPill>
                    </div>
                    <p className={styles.shopifyOrderMeta}>Created {new Date(selectedOrder.createdAt).toLocaleString()} from {selectedOrder.channel}</p>
                  </div>
                  <div className={styles.detailActions}>
                    <button className={styles.secondaryAction} type="button">Restock</button>
                    <button className={styles.secondaryAction} type="button">Return</button>
                    <button className={styles.secondaryAction} type="button">Edit</button>
                    <button className={styles.secondaryAction} type="button">Print</button>
                    <button className={styles.primaryAction} type="button">More actions</button>
                  </div>
                </div>

                <div className={styles.shopifyDetailLayout}>
                  <div className={styles.shopifyMainColumn}>
                    <div className={styles.detailSection}>
                      <div className={styles.sectionPillRow}>
                        <StatusPill tone={selectedOrder.fulfillmentStatus.replace(/\s+/g, '-')}>{selectedOrder.fulfillmentStatus}</StatusPill>
                        <strong>{selectedOrder.orderNumber}-F1</strong>
                      </div>

                      <div className={styles.fulfillmentCard}>
                        <StatusPill tone={selectedOrder.deliveryStatus.replace(/\s+/g, '-')}>{selectedOrder.deliveryStatus}</StatusPill>
                        <div className={styles.fulfillmentMetaList}>
                          <div>{new Date(selectedOrder.createdAt).toLocaleDateString()}</div>
                          <div>Ship from {settings.shippingOrigin}</div>
                          <div>{selectedOrder.carrier} tracking: {selectedOrder.trackingNumber || 'No tracking yet'}</div>
                        </div>
                        <div className={styles.shippingBuilderGrid}>
                          <select className={styles.detailSelect} onChange={event => setShippingLabelDraft(current => ({ ...current, packageType: event.target.value }))} value={shippingLabelDraft.packageType}>
                            <option>Small box</option>
                            <option>Medium box</option>
                            <option>Large box</option>
                            <option>Padded envelope</option>
                          </select>
                          <select className={styles.detailSelect} onChange={event => setShippingLabelDraft(current => ({ ...current, carrierService: event.target.value }))} value={shippingLabelDraft.carrierService}>
                            <option>UPS Ground</option>
                            <option>UPS 2nd Day Air</option>
                            <option>USPS Priority Mail</option>
                            <option>FedEx Home Delivery</option>
                          </select>
                          <input className={styles.detailInput} onChange={event => setShippingLabelDraft(current => ({ ...current, weight: event.target.value }))} placeholder="Weight" type="text" value={shippingLabelDraft.weight} />
                        </div>
                        <div className={styles.shippingActionRow}>
                          <button className={styles.secondaryAction} onClick={buyShippingLabel} type="button">Buy shipping label</button>
                          <button className={styles.secondaryAction} type="button">Print packing slip</button>
                          <button className={styles.secondaryAction} type="button">Print label</button>
                        </div>
                      </div>

                      <div className={styles.lineItemList}>
                        {selectedOrder.lineItems.map(item => (
                          <div key={item.id} className={styles.shopifyLineItemRow}>
                            <div className={styles.shopifyLineItemThumb} />
                            <div className={styles.shopifyLineItemInfo}>
                              <strong>{item.title}</strong>
                              <small>{item.variant}</small>
                            </div>
                            <div className={styles.shopifyLineItemPrice}>{formatOrderMoney(item.price)} × {item.quantity}</div>
                            <div className={styles.shopifyLineItemTotal}>{formatOrderMoney(item.price * item.quantity)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.detailSection}>
                      <div className={styles.sectionPillRow}>
                        <StatusPill tone={selectedOrder.paymentStatus.replace(/\s+/g, '-')}>{selectedOrder.paymentStatus}</StatusPill>
                      </div>
                      <div className={styles.paymentSummaryTable}>
                        <div><span>Subtotal</span><strong>{formatOrderMoney(selectedOrder.total)}</strong></div>
                        <div><span>Discount</span><strong>{selectedOrder.tags.includes('Draft converted') ? '- Custom discount' : '—'}</strong></div>
                        <div className={styles.totalRow}><span>Total</span><strong>{formatOrderMoney(selectedOrder.total)}</strong></div>
                        <div><span>Paid</span><strong>{selectedOrder.paymentStatus === 'paid' ? formatOrderMoney(selectedOrder.total) : '$0.00'}</strong></div>
                      </div>
                    </div>

                    <div className={styles.detailSection}>
                      <div className={styles.sectionCardHeader}><h3>Metafields</h3><button className={styles.inlineLinkButton} type="button">View all</button></div>
                      <p>No metafields pinned</p>
                    </div>

                    <div className={styles.detailSection}>
                      <h3>Timeline</h3>
                      <div className={styles.timelineComposer}>Leave a comment…</div>
                      <div className={styles.timelineList}>
                        {(selectedOrder.timeline || []).map(entry => (
                          <div key={entry.id} className={styles.timelineItem}>
                            <div className={styles.timelineDot} />
                            <div>
                              <strong>{entry.event}</strong>
                              <p>{entry.detail}</p>
                              <small>{new Date(entry.createdAt).toLocaleString()}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={styles.shopifySideColumn}>
                    <div className={styles.detailSection}>
                      <div className={styles.sectionCardHeader}><h3>Notes</h3><button className={styles.inlineLinkButton} type="button">Edit</button></div>
                      <textarea className={styles.notesInput} onChange={event => updateOrder(selectedOrder.id, order => ({ ...order, notes: event.target.value }))} rows={4} value={selectedOrder.notes} />
                    </div>

                    <div className={styles.detailSection}>
                      <div className={styles.sectionCardHeader}><h3>Customer</h3><button className={styles.inlineLinkButton} type="button">•••</button></div>
                      <p>{selectedOrder.customer.name}</p>
                      <small>{selectedOrder.customer.email}</small>
                      <div className={styles.customerBlockSpacing}>
                        <strong>Shipping address</strong>
                        <p>{selectedOrder.shippingAddress}</p>
                      </div>
                      <div className={styles.customerBlockSpacing}>
                        <strong>Billing address</strong>
                        <p>{selectedOrder.billingAddress}</p>
                      </div>
                    </div>

                    <div className={styles.detailSection}>
                      <h3>Conversion summary</h3>
                      <p>{selectedOrder.channel === 'Draft Orders' ? 'This order was converted from a draft order.' : "There aren't any conversion details available for this order."}</p>
                    </div>

                    <div className={styles.detailSection}>
                      <h3>Order risk</h3>
                      <p>{selectedOrder.riskLevel === 'medium' ? 'Review recommended before fulfillment.' : 'Analysis not available.'}</p>
                    </div>

                    <div className={styles.detailSection}>
                      <h3>Tags</h3>
                      <div className={styles.tagComposer}>
                        <div className={styles.tagList}>
                          {selectedOrder.tags.map(tag => (
                            <button key={`${selectedOrder.id}-${tag}`} className={styles.tagChip} onClick={() => updateOrder(selectedOrder.id, order => ({ ...order, tags: order.tags.filter(existingTag => existingTag !== tag) }))} type="button">
                              <span>{tag}</span>
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          ))}
                        </div>
                        <div className={styles.tagInputRow}>
                          <input className={styles.detailInput} onChange={event => setTagInput(event.target.value)} placeholder="Add tag" type="text" value={tagInput} />
                          <button className={styles.secondaryAction} onClick={addTagToOrder} type="button">Add tag</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
