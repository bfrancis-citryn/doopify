"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatOrderMoney } from '../../lib/ordersData';
import styles from './OrdersWorkspace.module.css';

function StatusPill({ children, tone }) {
  return <span className={`${styles.statusPill} ${styles[`tone_${tone}`]}`}>{children}</span>;
}

function normalizeOrderNumber(orderNumber) {
  return String(orderNumber || '').replace('#', '');
}

function normalizePaymentStatus(status) {
  return String(status || '').toUpperCase().replace(/\s+/g, '_');
}

function statusTone(status) {
  return String(status || 'pending').replace(/\s+/g, '-').replace(/_/g, '-').toLowerCase();
}

function lineItemVariantId(item) {
  return item.variantId || item.variant?.id || undefined;
}

function lineItemTitle(item) {
  return item.title || item.product?.title || 'Line item';
}

function lineItemVariantTitle(item) {
  return item.variantTitle || item.variant?.title || item.variant || '';
}

function lineItemsForOrder(order) {
  return order.lineItems || order.items || [];
}

function timelineForOrder(order) {
  return order.timeline || order.events || [];
}

function returnsForOrder(order) {
  return order.returns || [];
}

function buildRefundItems(selectedItems) {
  return selectedItems
    .filter(item => item.selected)
    .map(item => {
      const quantity = parseInt(item.refundQty, 10) || 1;
      return {
        orderItemId: item.id,
        variantId: lineItemVariantId(item),
        quantity,
        amount: Number((Number(item.price || 0) * quantity).toFixed(2)),
      };
    });
}

function RefundPanel({ order, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('requested_by_customer');
  const [note, setNote] = useState('');
  const [restockItems, setRestockItems] = useState(false);
  const [selectedItems, setSelectedItems] = useState(
    lineItemsForOrder(order).map(item => ({ ...item, selected: false, refundQty: item.quantity || 1 }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const payment = order.payments?.[0];
  const issuedRefundTotal = (order.refunds || [])
    .filter(refund => String(refund.status).toUpperCase() === 'ISSUED')
    .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const maxRefundable = payment ? Number((Number(payment.amount || 0) - issuedRefundTotal).toFixed(2)) : 0;

  async function handleSubmit(event) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!payment) { setError('No payment found on this order'); return; }
    if (!parsedAmount || parsedAmount <= 0) { setError('Enter a valid refund amount'); return; }
    if (parsedAmount > maxRefundable) { setError('Refund amount exceeds the remaining refundable amount'); return; }

    const items = restockItems ? buildRefundItems(selectedItems) : [];
    if (restockItems && items.length === 0) { setError('Select at least one item to restock'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${normalizeOrderNumber(order.orderNumber)}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id,
          amount: parsedAmount,
          reason,
          note: note || undefined,
          restockItems,
          items,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Refund failed');
      onSuccess('Refund issued', `Refunded ${formatOrderMoney(parsedAmount)}${restockItems ? ' and restocked selected items.' : '.'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.shopifyPanelClean} style={{ border: '2px solid #e3e3e3', marginBottom: 16 }}>
      <div className={styles.shopifyPanelHeaderClean}>
        <strong>Issue refund</strong>
        <button className={styles.textActionButton} onClick={onClose} type="button">Close</button>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{error}</p>}
        <label style={{ fontSize: 13 }}>
          Refund amount (max {formatOrderMoney(maxRefundable)})
          <input className={styles.detailInput} max={maxRefundable} min="0.01" step="0.01" type="number" value={amount} onChange={event => setAmount(event.target.value)} />
        </label>
        <label style={{ fontSize: 13 }}>
          Reason
          <select className={styles.detailSelect} value={reason} onChange={event => setReason(event.target.value)}>
            <option value="requested_by_customer">Requested by customer</option>
            <option value="duplicate">Duplicate</option>
            <option value="fraudulent">Fraudulent</option>
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Note
          <input className={styles.detailInput} type="text" value={note} onChange={event => setNote(event.target.value)} />
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input checked={restockItems} type="checkbox" onChange={event => setRestockItems(event.target.checked)} />
          Restock selected items after Stripe refund succeeds
        </label>
        {restockItems && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(selectedItems || []).map(item => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input checked={item.selected} type="checkbox" onChange={() => setSelectedItems(current => current.map(entry => entry.id === item.id ? { ...entry, selected: !entry.selected } : entry))} />
                <span style={{ flex: 1 }}>{lineItemTitle(item)}{lineItemVariantTitle(item) ? ` - ${lineItemVariantTitle(item)}` : ''}</span>
                <input className={styles.detailInput} max={item.quantity} min="1" style={{ width: 64 }} type="number" value={item.refundQty} onChange={event => setSelectedItems(current => current.map(entry => entry.id === item.id ? { ...entry, refundQty: event.target.value } : entry))} />
              </label>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.primaryAction} disabled={submitting} type="submit">{submitting ? 'Refunding...' : 'Issue refund'}</button>
          <button className={styles.secondaryAction} onClick={onClose} type="button">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function ReturnPanel({ order, onClose, onSuccess }) {
  const [selectedItems, setSelectedItems] = useState(
    lineItemsForOrder(order).map(item => ({ ...item, selected: false, returnQty: item.quantity || 1, returnReason: '' }))
  );
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const items = selectedItems.filter(item => item.selected).map(item => ({
      orderItemId: item.id,
      variantId: lineItemVariantId(item),
      quantity: parseInt(item.returnQty, 10) || 1,
      reason: item.returnReason || undefined,
    }));
    if (!items.length) { setError('Select at least one item'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${normalizeOrderNumber(order.orderNumber)}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, note: note || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create return');
      onSuccess('Return requested', `${items.length} item${items.length === 1 ? '' : 's'} added to the return workflow.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create return');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.shopifyPanelClean} style={{ border: '2px solid #e3e3e3', marginBottom: 16 }}>
      <div className={styles.shopifyPanelHeaderClean}>
        <strong>Create return</strong>
        <button className={styles.textActionButton} onClick={onClose} type="button">Close</button>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{error}</p>}
        {(selectedItems || []).map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input checked={item.selected} type="checkbox" onChange={() => setSelectedItems(current => current.map(entry => entry.id === item.id ? { ...entry, selected: !entry.selected } : entry))} />
            <span style={{ flex: 1 }}>{lineItemTitle(item)}{lineItemVariantTitle(item) ? ` - ${lineItemVariantTitle(item)}` : ''}</span>
            {item.selected && (
              <>
                <input className={styles.detailInput} max={item.quantity} min="1" style={{ width: 64 }} type="number" value={item.returnQty} onChange={event => setSelectedItems(current => current.map(entry => entry.id === item.id ? { ...entry, returnQty: event.target.value } : entry))} />
                <input className={styles.detailInput} placeholder="Reason" type="text" value={item.returnReason} onChange={event => setSelectedItems(current => current.map(entry => entry.id === item.id ? { ...entry, returnReason: event.target.value } : entry))} />
              </>
            )}
          </div>
        ))}
        <label style={{ fontSize: 13 }}>
          Note
          <input className={styles.detailInput} type="text" value={note} onChange={event => setNote(event.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.primaryAction} disabled={submitting} type="submit">{submitting ? 'Creating...' : 'Create return'}</button>
          <button className={styles.secondaryAction} onClick={onClose} type="button">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function getNextReturnActions(status) {
  switch (status) {
    case 'REQUESTED':
      return [
        { status: 'APPROVED', label: 'Approve' },
        { status: 'DECLINED', label: 'Decline' },
      ];
    case 'APPROVED':
      return [
        { status: 'IN_TRANSIT', label: 'Mark in transit' },
        { status: 'DECLINED', label: 'Decline' },
      ];
    case 'IN_TRANSIT':
      return [{ status: 'RECEIVED', label: 'Mark received' }];
    default:
      return [];
  }
}

function ReturnWorkflowPanel({ order, onRefresh, onTimeline }) {
  const [activeCloseReturnId, setActiveCloseReturnId] = useState(null);
  const [submittingStatus, setSubmittingStatus] = useState(null);
  const [workflowError, setWorkflowError] = useState(null);
  const returns = returnsForOrder(order);
  const payment = order.payments?.[0];

  async function updateStatus(returnRecord, status) {
    setSubmittingStatus(`${returnRecord.id}:${status}`);
    setWorkflowError(null);
    try {
      const res = await fetch(`/api/orders/${normalizeOrderNumber(order.orderNumber)}/returns/${returnRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to update return');
      await onRefresh();
      onTimeline('Return updated', `Return ${returnRecord.id.slice(0, 8)} moved to ${status.toLowerCase().replace(/_/g, ' ')}.`);
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : 'Failed to update return');
    } finally {
      setSubmittingStatus(null);
    }
  }

  return (
    <div className={styles.shopifyPanelClean}>
      <div className={styles.shopifyPanelHeaderClean}>
        <strong>Returns</strong>
        <span style={{ fontSize: 13, color: '#666' }}>{returns.length} active/history</span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {workflowError && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{workflowError}</p>}
        {!returns.length && <p className={styles.cardSubtext}>No returns have been created for this order yet.</p>}
        {returns.map(returnRecord => {
          const nextActions = getNextReturnActions(returnRecord.status);
          const isCloseActive = activeCloseReturnId === returnRecord.id;
          return (
            <div key={returnRecord.id} style={{ border: '1px solid #e3e3e3', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong>Return {returnRecord.id.slice(0, 8)}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>{returnRecord.reason || returnRecord.note || 'No reason provided'}</p>
                </div>
                <StatusPill tone={statusTone(returnRecord.status)}>{returnRecord.status}</StatusPill>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(returnRecord.items || []).map(item => {
                  const orderItem = lineItemsForOrder(order).find(entry => entry.id === item.orderItemId);
                  return (
                    <div key={item.id || item.orderItemId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                      <span>{orderItem ? lineItemTitle(orderItem) : item.orderItemId}{orderItem && lineItemVariantTitle(orderItem) ? ` - ${lineItemVariantTitle(orderItem)}` : ''}</span>
                      <span>Qty {item.quantity}</span>
                    </div>
                  );
                })}
              </div>
              {returnRecord.refund && (
                <p style={{ margin: 0, fontSize: 13, color: '#555' }}>
                  Linked refund: {formatOrderMoney(returnRecord.refund.amount)} ({returnRecord.refund.status})
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {nextActions.map(action => (
                  <button
                    key={action.status}
                    className={styles.secondaryAction}
                    disabled={Boolean(submittingStatus)}
                    onClick={() => updateStatus(returnRecord, action.status)}
                    type="button"
                  >
                    {submittingStatus === `${returnRecord.id}:${action.status}` ? 'Saving...' : action.label}
                  </button>
                ))}
                {returnRecord.status === 'RECEIVED' && !returnRecord.refundId && !returnRecord.refund && (
                  <button className={styles.primaryAction} onClick={() => setActiveCloseReturnId(isCloseActive ? null : returnRecord.id)} type="button">
                    {isCloseActive ? 'Hide refund form' : 'Close with refund'}
                  </button>
                )}
              </div>
              {isCloseActive && (
                <CloseReturnRefundForm
                  order={order}
                  payment={payment}
                  returnRecord={returnRecord}
                  onCancel={() => setActiveCloseReturnId(null)}
                  onRefresh={onRefresh}
                  onTimeline={onTimeline}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CloseReturnRefundForm({ order, payment, returnRecord, onCancel, onRefresh, onTimeline }) {
  const defaultAmount = (returnRecord.items || []).reduce((sum, item) => {
    const orderItem = lineItemsForOrder(order).find(entry => entry.id === item.orderItemId);
    return sum + Number(orderItem?.price || 0) * Number(item.quantity || 0);
  }, 0);
  const [amount, setAmount] = useState(defaultAmount ? defaultAmount.toFixed(2) : '');
  const [note, setNote] = useState('Return received and refunded');
  const [restockItems, setRestockItems] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!payment) { setError('No payment found on this order'); return; }
    if (!parsedAmount || parsedAmount <= 0) { setError('Enter a valid refund amount'); return; }

    const items = (returnRecord.items || []).map(item => {
      const orderItem = lineItemsForOrder(order).find(entry => entry.id === item.orderItemId);
      const quantity = Number(item.quantity || 1);
      return {
        orderItemId: item.orderItemId,
        variantId: item.variantId || lineItemVariantId(orderItem || {}),
        quantity,
        amount: Number((Number(orderItem?.price || 0) * quantity).toFixed(2)),
      };
    });

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${normalizeOrderNumber(order.orderNumber)}/returns/${returnRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CLOSED',
          note: note || undefined,
          refund: {
            paymentId: payment.id,
            amount: parsedAmount,
            reason: 'requested_by_customer',
            restockItems,
            items,
          },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to close return');
      await onRefresh();
      onTimeline('Return closed', `Return ${returnRecord.id.slice(0, 8)} closed with a ${formatOrderMoney(parsedAmount)} refund.`);
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close return');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ borderTop: '1px solid #e3e3e3', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {error && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{error}</p>}
      <label style={{ fontSize: 13 }}>
        Refund amount
        <input className={styles.detailInput} min="0.01" step="0.01" type="number" value={amount} onChange={event => setAmount(event.target.value)} />
      </label>
      <label style={{ fontSize: 13 }}>
        Note
        <input className={styles.detailInput} type="text" value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input checked={restockItems} type="checkbox" onChange={event => setRestockItems(event.target.checked)} />
        Restock returned items
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className={styles.primaryAction} disabled={submitting} type="submit">{submitting ? 'Closing...' : 'Issue refund and close'}</button>
        <button className={styles.secondaryAction} disabled={submitting} onClick={onCancel} type="button">Cancel</button>
      </div>
    </form>
  );
}

export default function OrderDetailView({ order, onUpdateOrder }) {
  const [tagInput, setTagInput] = useState('');
  const [activePanel, setActivePanel] = useState(null);
  const [liveOrder, setLiveOrder] = useState(order);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setLiveOrder(order);
  }, [order]);

  const currentOrder = liveOrder || order;

  async function refreshOrder() {
    if (!currentOrder?.orderNumber) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/orders/${normalizeOrderNumber(currentOrder.orderNumber)}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setLiveOrder(json.data);
      }
    } finally {
      setRefreshing(false);
    }
  }

  if (!currentOrder) {
    return (
      <div className={styles.orderDetailPage}>
        <div className={styles.orderDetailBreadcrumbs}>
          <Link className={styles.inlineLinkButton} href="/orders">← Orders</Link>
        </div>
        <div className={styles.emptyState}>
          <h2>Order not found</h2>
          <p>That order route exists, but there is no matching order in the current data set yet.</p>
        </div>
      </div>
    );
  }

  function appendTimeline(event, detail) {
    if (!onUpdateOrder) return;
    onUpdateOrder(currentOrder.id, existingOrder => ({
      ...existingOrder,
      timeline: [
        { id: `${existingOrder.id}-${event}-${Date.now()}`, event, detail, createdAt: new Date().toISOString() },
        ...(existingOrder.timeline || []),
      ],
    }));
  }

  async function handlePanelSuccess(event, detail) {
    await refreshOrder();
    appendTimeline(event, detail);
    setActivePanel(null);
  }

  function addTagToOrder() {
    const normalizedTag = tagInput.trim();
    if (!normalizedTag || !onUpdateOrder) return;
    onUpdateOrder(currentOrder.id, existingOrder => ({
      ...existingOrder,
      tags: [...new Set([...(existingOrder.tags || []), normalizedTag])],
    }));
    setTagInput('');
  }

  const paymentTone = statusTone(currentOrder.paymentStatus);
  const fulfillmentTone = statusTone(currentOrder.fulfillmentStatus);
  const canRefundOrReturn = ['PAID', 'PARTIALLY_REFUNDED'].includes(normalizePaymentStatus(currentOrder.paymentStatus));
  const orderLineItems = lineItemsForOrder(currentOrder);
  const timelineEntries = timelineForOrder(currentOrder);

  return (
    <div className={styles.orderDetailPage}>
      <div className={styles.orderDetailBreadcrumbs}>
        <Link className={styles.inlineLinkButton} href="/orders">← Orders</Link>
      </div>

      <div className={styles.shopifyHeaderBarClean}>
        <div className={styles.shopifyHeaderIdentity}>
          <div className={styles.shopifyHeaderTitleRow}>
            <span className="material-symbols-outlined">draft_orders</span>
            <h1 className={styles.detailTitle}>{currentOrder.orderNumber}</h1>
            <StatusPill tone={paymentTone}>{currentOrder.paymentStatus}</StatusPill>
            <StatusPill tone={fulfillmentTone}>{currentOrder.fulfillmentStatus}</StatusPill>
          </div>
          <p className={styles.shopifyOrderMeta}>Created {new Date(currentOrder.createdAt).toLocaleString()} from {currentOrder.channel}</p>
        </div>
        <div className={styles.shopifyHeaderActionsClean}>
          <button className={styles.secondaryAction} disabled={refreshing} onClick={refreshOrder} type="button">{refreshing ? 'Refreshing...' : 'Refresh'}</button>
          <button className={styles.secondaryAction} disabled={!canRefundOrReturn} onClick={() => setActivePanel(activePanel === 'refund' ? null : 'refund')} type="button">Refund</button>
          <button className={styles.secondaryAction} disabled={!canRefundOrReturn} onClick={() => setActivePanel(activePanel === 'return' ? null : 'return')} type="button">Return</button>
          <button className={styles.secondaryAction} type="button">Print</button>
        </div>
      </div>

      {activePanel === 'refund' && <RefundPanel order={currentOrder} onClose={() => setActivePanel(null)} onSuccess={handlePanelSuccess} />}
      {activePanel === 'return' && <ReturnPanel order={currentOrder} onClose={() => setActivePanel(null)} onSuccess={handlePanelSuccess} />}

      <div className={styles.shopifyDetailGridClean}>
        <div className={styles.shopifyMainColumn}>
          <div className={styles.shopifyPanelClean}>
            <div className={styles.shopifyPanelHeaderClean}>
              <strong>Items</strong>
              <StatusPill tone={fulfillmentTone}>{currentOrder.fulfillmentStatus}</StatusPill>
            </div>
            <div className={styles.shopifyLineItemTable}>
              {orderLineItems.map(item => (
                <div key={item.id} className={styles.shopifyLineItemRowClean}>
                  <div className={styles.shopifyLineItemThumb} />
                  <div className={styles.shopifyLineItemInfo}>
                    <strong>{lineItemTitle(item)}</strong>
                    <small className={styles.lineItemSubtext}>{lineItemVariantTitle(item)}</small>
                  </div>
                  <div className={styles.shopifyLineItemMeta}>{formatOrderMoney(item.price)}</div>
                  <div className={styles.shopifyQtyBadge}>{item.quantity}</div>
                  <div className={styles.shopifyLineItemTotal}>{formatOrderMoney(Number(item.price || 0) * Number(item.quantity || 0))}</div>
                </div>
              ))}
            </div>
          </div>

          <ReturnWorkflowPanel order={currentOrder} onRefresh={refreshOrder} onTimeline={appendTimeline} />

          <div className={styles.shopifyPanelClean}>
            <div className={styles.shopifyPanelHeaderClean}>
              <StatusPill tone={paymentTone}>{currentOrder.paymentStatus}</StatusPill>
            </div>
            <div className={styles.shopifyPaymentTableClean}>
              <div className={styles.shopifyPaymentRowClean}>
                <span>Subtotal</span>
                <span>{currentOrder.itemCount || orderLineItems.length} item{(currentOrder.itemCount || orderLineItems.length) === 1 ? '' : 's'}</span>
                <strong>{formatOrderMoney(currentOrder.subtotal ?? currentOrder.total)}</strong>
              </div>
              <div className={styles.shopifyPaymentRowClean}>
                <span>Shipping</span>
                <span></span>
                <strong>{formatOrderMoney(currentOrder.shippingAmount)}</strong>
              </div>
              <div className={styles.shopifyPaymentRowClean}>
                <span>Taxes</span>
                <span></span>
                <strong>{formatOrderMoney(currentOrder.taxAmount)}</strong>
              </div>
              <div className={`${styles.shopifyPaymentRowClean} ${styles.shopifyPaymentTotalRow}`}>
                <span>Total</span>
                <span></span>
                <strong>{formatOrderMoney(currentOrder.total)}</strong>
              </div>
            </div>
          </div>

          <div className={styles.timelineSectionClean}>
            <div className={styles.sectionCardHeader}><h3>Timeline</h3></div>
            <div className={styles.timelineListClean}>
              {timelineEntries.map(entry => (
                <div key={entry.id} className={styles.timelineRowClean}>
                  <div className={styles.timelineAvatar}>DP</div>
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineHeaderRow}>
                      <strong>{entry.event || entry.title || entry.type}</strong>
                      <small>{new Date(entry.createdAt).toLocaleString()}</small>
                    </div>
                    <p>{entry.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.shopifySideColumnCompact}>
          <div className={styles.shopifySidePanelClean}>
            <div className={styles.sectionCardHeader}><h3>Customer</h3></div>
            <div className={styles.infoListTight}>
              <a className={styles.customerLink} href={`mailto:${currentOrder.customer?.email || currentOrder.email || ''}`}>{currentOrder.customer?.name || currentOrder.customer?.firstName || currentOrder.email || 'Customer'}</a>
              <a className={styles.customerLink} href={`mailto:${currentOrder.customer?.email || currentOrder.email || ''}`}>{currentOrder.customer?.email || currentOrder.email}</a>
            </div>
          </div>

          <div className={styles.shopifySidePanelClean}>
            <div className={styles.sectionCardHeader}><h3>Addresses</h3></div>
            <div className={styles.addressList}>
              <div className={styles.addressBlock}><strong>Shipping</strong><p>{currentOrder.shippingAddress || currentOrder.addresses?.find(address => address.type === 'SHIPPING')?.address1 || 'No shipping address'}</p></div>
              <div className={styles.addressBlock}><strong>Billing</strong><p>{currentOrder.billingAddress || currentOrder.addresses?.find(address => address.type === 'BILLING')?.address1 || 'No billing address'}</p></div>
            </div>
          </div>

          <div className={styles.shopifySidePanelClean}>
            <div className={styles.sectionCardHeader}><h3>Tags</h3></div>
            <div className={styles.tagComposer}>
              <div className={styles.tagList}>
                {(currentOrder.tags || []).map(tag => (
                  <button key={`${currentOrder.id}-${tag}`} className={styles.tagChip} onClick={() => onUpdateOrder?.(currentOrder.id, existingOrder => ({ ...existingOrder, tags: existingOrder.tags.filter(existingTag => existingTag !== tag) }))} type="button">
                    <span>{tag}</span>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                ))}
              </div>
              <div className={styles.tagInputRow}>
                <input className={styles.detailInput} onChange={event => setTagInput(event.target.value)} placeholder="Add tag" type="text" value={tagInput} />
                <button className={styles.secondaryAction} onClick={addTagToOrder} type="button">Add</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
