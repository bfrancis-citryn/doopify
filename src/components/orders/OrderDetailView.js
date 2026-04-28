"use client";

import Link from 'next/link';
import { useState } from 'react';
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

function lineItemVariantId(item) {
  return item.variantId || item.variant?.id || undefined;
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
    (order.lineItems || []).map(item => ({ ...item, selected: false, refundQty: item.quantity || 1 }))
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
                <span style={{ flex: 1 }}>{item.title}{item.variant ? ` - ${item.variant}` : ''}</span>
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
    (order.lineItems || []).map(item => ({ ...item, selected: false, returnQty: item.quantity || 1, returnReason: '' }))
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
            <span style={{ flex: 1 }}>{item.title}{item.variant ? ` - ${item.variant}` : ''}</span>
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

export default function OrderDetailView({ order, onUpdateOrder }) {
  const [tagInput, setTagInput] = useState('');
  const [activePanel, setActivePanel] = useState(null);

  if (!order) {
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
    onUpdateOrder(order.id, currentOrder => ({
      ...currentOrder,
      timeline: [
        { id: `${currentOrder.id}-${event}-${Date.now()}`, event, detail, createdAt: new Date().toISOString() },
        ...(currentOrder.timeline || []),
      ],
    }));
  }

  function handlePanelSuccess(event, detail) {
    appendTimeline(event, detail);
    setActivePanel(null);
  }

  function addTagToOrder() {
    const normalizedTag = tagInput.trim();
    if (!normalizedTag) return;
    onUpdateOrder(order.id, currentOrder => ({
      ...currentOrder,
      tags: [...new Set([...(currentOrder.tags || []), normalizedTag])],
    }));
    setTagInput('');
  }

  const paymentTone = String(order.paymentStatus || '').replace(/\s+/g, '-').toLowerCase();
  const fulfillmentTone = String(order.fulfillmentStatus || '').replace(/\s+/g, '-').toLowerCase();
  const canRefundOrReturn = ['PAID', 'PARTIALLY_REFUNDED'].includes(normalizePaymentStatus(order.paymentStatus));

  return (
    <div className={styles.orderDetailPage}>
      <div className={styles.orderDetailBreadcrumbs}>
        <Link className={styles.inlineLinkButton} href="/orders">← Orders</Link>
      </div>

      <div className={styles.shopifyHeaderBarClean}>
        <div className={styles.shopifyHeaderIdentity}>
          <div className={styles.shopifyHeaderTitleRow}>
            <span className="material-symbols-outlined">draft_orders</span>
            <h1 className={styles.detailTitle}>{order.orderNumber}</h1>
            <StatusPill tone={paymentTone}>{order.paymentStatus}</StatusPill>
            <StatusPill tone={fulfillmentTone}>{order.fulfillmentStatus}</StatusPill>
          </div>
          <p className={styles.shopifyOrderMeta}>Created {new Date(order.createdAt).toLocaleString()} from {order.channel}</p>
        </div>
        <div className={styles.shopifyHeaderActionsClean}>
          <button className={styles.secondaryAction} disabled={!canRefundOrReturn} onClick={() => setActivePanel(activePanel === 'refund' ? null : 'refund')} type="button">Refund</button>
          <button className={styles.secondaryAction} disabled={!canRefundOrReturn} onClick={() => setActivePanel(activePanel === 'return' ? null : 'return')} type="button">Return</button>
          <button className={styles.secondaryAction} type="button">Print</button>
        </div>
      </div>

      {activePanel === 'refund' && <RefundPanel order={order} onClose={() => setActivePanel(null)} onSuccess={handlePanelSuccess} />}
      {activePanel === 'return' && <ReturnPanel order={order} onClose={() => setActivePanel(null)} onSuccess={handlePanelSuccess} />}

      <div className={styles.shopifyDetailGridClean}>
        <div className={styles.shopifyMainColumn}>
          <div className={styles.shopifyPanelClean}>
            <div className={styles.shopifyPanelHeaderClean}>
              <strong>Items</strong>
              <StatusPill tone={fulfillmentTone}>{order.fulfillmentStatus}</StatusPill>
            </div>
            <div className={styles.shopifyLineItemTable}>
              {(order.lineItems || []).map(item => (
                <div key={item.id} className={styles.shopifyLineItemRowClean}>
                  <div className={styles.shopifyLineItemThumb} />
                  <div className={styles.shopifyLineItemInfo}>
                    <strong>{item.title}</strong>
                    <small className={styles.lineItemSubtext}>{item.variant}</small>
                  </div>
                  <div className={styles.shopifyLineItemMeta}>{formatOrderMoney(item.price)}</div>
                  <div className={styles.shopifyQtyBadge}>{item.quantity}</div>
                  <div className={styles.shopifyLineItemTotal}>{formatOrderMoney(Number(item.price || 0) * Number(item.quantity || 0))}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.shopifyPanelClean}>
            <div className={styles.shopifyPanelHeaderClean}>
              <StatusPill tone={paymentTone}>{order.paymentStatus}</StatusPill>
            </div>
            <div className={styles.shopifyPaymentTableClean}>
              <div className={styles.shopifyPaymentRowClean}>
                <span>Subtotal</span>
                <span>{order.itemCount} item{order.itemCount === 1 ? '' : 's'}</span>
                <strong>{formatOrderMoney(order.subtotal ?? order.total)}</strong>
              </div>
              <div className={styles.shopifyPaymentRowClean}>
                <span>Shipping</span>
                <span></span>
                <strong>{formatOrderMoney(order.shippingAmount)}</strong>
              </div>
              <div className={styles.shopifyPaymentRowClean}>
                <span>Taxes</span>
                <span></span>
                <strong>{formatOrderMoney(order.taxAmount)}</strong>
              </div>
              <div className={`${styles.shopifyPaymentRowClean} ${styles.shopifyPaymentTotalRow}`}>
                <span>Total</span>
                <span></span>
                <strong>{formatOrderMoney(order.total)}</strong>
              </div>
            </div>
          </div>

          <div className={styles.timelineSectionClean}>
            <div className={styles.sectionCardHeader}><h3>Timeline</h3></div>
            <div className={styles.timelineListClean}>
              {(order.timeline || []).map(entry => (
                <div key={entry.id} className={styles.timelineRowClean}>
                  <div className={styles.timelineAvatar}>DP</div>
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineHeaderRow}>
                      <strong>{entry.event}</strong>
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
              <a className={styles.customerLink} href={`mailto:${order.customer?.email || ''}`}>{order.customer?.name || 'Customer'}</a>
              <a className={styles.customerLink} href={`mailto:${order.customer?.email || ''}`}>{order.customer?.email}</a>
            </div>
          </div>

          <div className={styles.shopifySidePanelClean}>
            <div className={styles.sectionCardHeader}><h3>Addresses</h3></div>
            <div className={styles.addressList}>
              <div className={styles.addressBlock}><strong>Shipping</strong><p>{order.shippingAddress}</p></div>
              <div className={styles.addressBlock}><strong>Billing</strong><p>{order.billingAddress}</p></div>
            </div>
          </div>

          <div className={styles.shopifySidePanelClean}>
            <div className={styles.sectionCardHeader}><h3>Tags</h3></div>
            <div className={styles.tagComposer}>
              <div className={styles.tagList}>
                {(order.tags || []).map(tag => (
                  <button key={`${order.id}-${tag}`} className={styles.tagChip} onClick={() => onUpdateOrder(order.id, currentOrder => ({ ...currentOrder, tags: currentOrder.tags.filter(existingTag => existingTag !== tag) }))} type="button">
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
