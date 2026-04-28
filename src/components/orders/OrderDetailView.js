"use client";

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { formatOrderMoney } from '../../lib/ordersData';
import styles from './OrdersWorkspace.module.css';

function StatusPill({ children, tone }) {
  return <span className={`${styles.statusPill} ${styles[`tone_${tone}`]}`}>{children}</span>;
}

function formatTimelineDate(value) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ── Refund Panel ──────────────────────────────────────────────────────────────
function RefundPanel({ order, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('requested_by_customer');
  const [note, setNote] = useState('');
  const [restockItems, setRestockItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const payment = order.payments?.[0];
  const maxRefundable = payment ? payment.amount - (order.refunds || []).filter(r => r.status === 'ISSUED').reduce((s, r) => s + r.amount, 0) : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) { setError('Enter a valid amount'); return; }
    if (!payment) { setError('No payment found on this order'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const orderNum = order.orderNumber.replace('#', '');
      const res = await fetch(`/api/orders/${orderNum}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payment.id, amount: parsedAmount, reason, note: note || undefined, restockItems }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Refund failed');
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.shopifyPanelClean} style={{ border: '2px solid #e3e3e3', marginBottom: '16px' }}>
      <div className={styles.shopifyPanelHeaderClean}>
        <strong>Issue refund</strong>
        <button className={styles.textActionButton} onClick={onClose} type="button">✕</button>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {error && <p style={{ color: '#c0392b', fontSize: '13px', margin: 0 }}>{error}</p>}
        <label style={{ fontSize: '13px' }}>
          Refund amount (max {formatOrderMoney(maxRefundable)})
          <input
            className={styles.detailInput}
            min="0.01"
            max={maxRefundable}
            placeholder="0.00"
            step="0.01"
            style={{ marginTop: '4px', width: '100%' }}
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </label>
        <label style={{ fontSize: '13px' }}>
          Reason
          <select className={styles.detailSelect} style={{ marginTop: '4px', width: '100%' }} value={reason} onChange={e => setReason(e.target.value)}>
            <option value="requested_by_customer">Requested by customer</option>
            <option value="duplicate">Duplicate</option>
            <option value="fraudulent">Fraudulent</option>
          </select>
        </label>
        <label style={{ fontSize: '13px' }}>
          Note (optional)
          <input className={styles.detailInput} placeholder="Internal note" style={{ marginTop: '4px', width: '100%' }} type="text" value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input checked={restockItems} type="checkbox" onChange={e => setRestockItems(e.target.checked)} />
          Restock items
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.primaryAction} disabled={submitting} type="submit">{submitting ? 'Refunding…' : 'Issue refund'}</button>
          <button className={styles.secondaryAction} onClick={onClose} type="button">Cancel</button>
        </div>
      </form>
    </div>
  );
}

// ── Return Panel ──────────────────────────────────────────────────────────────
function ReturnPanel({ order, onClose, onSuccess }) {
  const [selectedItems, setSelectedItems] = useState(
    (order.lineItems || []).map(item => ({ ...item, selected: false, returnQty: item.quantity, returnReason: '' }))
  );
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function toggleItem(id) {
    setSelectedItems(current => current.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const items = selectedItems.filter(i => i.selected).map(i => ({
      orderItemId: i.id,
      quantity: parseInt(i.returnQty, 10) || 1,
      reason: i.returnReason || undefined,
    }));
    if (!items.length) { setError('Select at least one item'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const orderNum = order.orderNumber.replace('#', '');
      const res = await fetch(`/api/orders/${orderNum}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, note: note || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create return');
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.shopifyPanelClean} style={{ border: '2px solid #e3e3e3', marginBottom: '16px' }}>
      <div className={styles.shopifyPanelHeaderClean}>
        <strong>Create return</strong>
        <button className={styles.textActionButton} onClick={onClose} type="button">✕</button>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {error && <p style={{ color: '#c0392b', fontSize: '13px', margin: 0 }}>{error}</p>}
        <p style={{ fontSize: '13px', margin: 0, color: '#555' }}>Select items to return:</p>
        {selectedItems.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <input checked={item.selected} type="checkbox" onChange={() => toggleItem(item.id)} />
            <span style={{ flex: 1 }}>{item.title}{item.variant ? ` — ${item.variant}` : ''}</span>
            {item.selected && (
              <>
                <input
                  className={styles.detailInput}
                  max={item.quantity}
                  min="1"
                  style={{ width: '48px' }}
                  type="number"
                  value={item.returnQty}
                  onChange={e => setSelectedItems(c => c.map(i => i.id === item.id ? { ...i, returnQty: e.target.value } : i))}
                />
                <input
                  className={styles.detailInput}
                  placeholder="Reason"
                  style={{ flex: 1 }}
                  type="text"
                  value={item.returnReason}
                  onChange={e => setSelectedItems(c => c.map(i => i.id === item.id ? { ...i, returnReason: e.target.value } : i))}
                />
              </>
            )}
          </div>
        ))}
        <label style={{ fontSize: '13px' }}>
          Note (optional)
          <input className={styles.detailInput} placeholder="Internal note" style={{ marginTop: '4px', width: '100%' }} type="text" value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.primaryAction} disabled={submitting} type="submit">{submitting ? 'Creating…' : 'Create return'}</button>
          <button className={styles.secondaryAction} onClick={onClose} type="button">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function OrderDetailView({ order, onUpdateOrder }) {
  const { settings } = useSettings();
  const [tagInput, setTagInput] = useState('');
  const [activePanel, setActivePanel] = useState(null); // 'refund' | 'return' | null
  const [shippingLabelDraft, setShippingLabelDraft] = useState({
    packageType: 'Small box',
    carrierService: 'UPS Ground',
    weight: '1.0 lb',
  });
  const timelineCounterRef = useRef(0);

  const appendTimeline = (currentOrder, event, detail) => {
    timelineCounterRef.current += 1;

    return {
      ...currentOrder,
      timeline: [
        {
          id: `${currentOrder.id}-${event}-${timelineCounterRef.current}`,
          event,
          detail,
          createdAt: new Date().toISOString(),
        },
        ...(currentOrder.timeline || []),
      ],
    };
  };

  const addTagToOrder = () => {
    const normalizedTag = tagInput.trim();
    if (!order || !normalizedTag) {
      return;
    }

    onUpdateOrder(order.id, currentOrder => ({
      ...currentOrder,
      tags: [...new Set([...(currentOrder.tags || []), normalizedTag])],
    }));
    setTagInput('');
  };

  const buyShippingLabel = () => {
    if (!order) {
      return;
    }

    onUpdateOrder(order.id, currentOrder =>
      appendTimeline(
        {
          ...currentOrder,
          trackingNumber: currentOrder.trackingNumber || `LBL-${currentOrder.orderNumber.replace('#', '')}`,
          carrier: shippingLabelDraft.carrierService,
          deliveryStatus: currentOrder.deliveryStatus === 'not-shipped' ? 'in-transit' : currentOrder.deliveryStatus,
          fulfillmentStatus: currentOrder.fulfillmentStatus === 'unfulfilled' ? 'packed' : currentOrder.fulfillmentStatus,
        },
        'Shipping label purchased',
        `${shippingLabelDraft.carrierService} label created for ${shippingLabelDraft.packageType} (${shippingLabelDraft.weight}).`
      )
    );
  };

  if (!order) {
    return (
      <div className={styles.orderDetailPage}>
        <div className={styles.orderDetailBreadcrumbs}>
          <Link className={styles.inlineLinkButton} href="/orders">
            ← Orders
          </Link>
        </div>
        <div className={styles.emptyState}>
          <h2>Order not found</h2>
          <p>That order route exists, but there is no matching order in the current data set yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.orderDetailPage}>
      <div className={styles.orderDetailBreadcrumbs}>
        <Link className={styles.inlineLinkButton} href="/orders">
          ← Orders
        </Link>
      </div>

      <div className={styles.shopifyHeaderBarClean}> 
        <div className={styles.shopifyHeaderIdentity}>
          <div className={styles.shopifyHeaderTitleRow}>
            <span className="material-symbols-outlined">draft_orders</span>
            <h1 className={styles.detailTitle}>{order.orderNumber}</h1>
            <StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill>
            <StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill>
            <span className={styles.archivedBadge}>Archived</span>
          </div>
          <p className={styles.shopifyOrderMeta}>Created {new Date(order.createdAt).toLocaleString()} from {order.channel}</p>
        </div>
        <div className={styles.shopifyHeaderActionsClean}>
          <button className={styles.secondaryAction} type="button">Refund</button>
          <button className={styles.secondaryAction} type="button">Return</button>
          <button className={styles.secondaryAction} type="button">Edit</button>
          <button className={styles.secondaryAction} type="button">Print</button>
          <button className={styles.primaryAction} type="button">More actions</button>
        </div>
      </div>

      <div className={styles.shopifyDetailGridClean}>
        <div className={styles.shopifyMainColumn}>
          <div className={styles.shopifyPanelClean}>
            <div className={styles.shopifyPanelHeaderClean}>
              <div className={styles.sectionPillRow}>
                <StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill>
                <strong>{order.orderNumber}-F1</strong>
              </div>
              <button className={styles.textActionButton} type="button">•••</button>
            </div>

            <div className={styles.shopifyInsetPanelClean}>
              <div className={styles.sectionPillRow}>
                <StatusPill tone={order.deliveryStatus.replace(/\s+/g, '-')}>{order.deliveryStatus}</StatusPill>
              </div>
              <div className={styles.infoListTight}>
                <div>{new Date(order.createdAt).toLocaleDateString()}</div>
                <div>Deliver by Friday, April 10, 2026</div>
                <div>{order.carrier} tracking: {order.trackingNumber || 'No tracking number yet'}</div>
              </div>
            </div>

            <div className={styles.shopifyLineItemTable}>
              {order.lineItems.map(item => (
                <div key={item.id} className={styles.shopifyLineItemRowClean}>
                  <div className={styles.shopifyLineItemThumb} />
                  <div className={styles.shopifyLineItemInfo}>
                    <strong>{item.title}</strong>
                    <small className={styles.lineItemSubtext}>{item.variant}</small>
                  </div>
                  <div className={styles.shopifyLineItemMeta}>{formatOrderMoney(item.price)}</div>
                  <div className={styles.shopifyQtyBadge}>{item.quantity}</div>
                  <div className={styles.shopifyLineItemTotal}>{formatOrderMoney(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.shopifyPanelClean}>
            <div className={styles.shopifyPanelHeaderClean}>
              <StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill>
            </div>

            <div className={styles.shopifyPaymentTableClean}>
              <div className={styles.shopifyPaymentRowClean}>
                <span>Subtotal</span>
                <span>{order.itemCount} item{order.itemCount === 1 ? '' : 's'}</span>
                <strong>{formatOrderMoney(order.total)}</strong>
              </div>
              <div className={styles.shopifyPaymentRowClean}>
                <span>Shipping</span>
                <span>{shippingLabelDraft.carrierService} ({shippingLabelDraft.weight})</span>
                <strong>$8.00</strong>
              </div>
              <div className={styles.shopifyPaymentRowClean}>
                <span>Taxes</span>
                <span>Tax details</span>
                <strong>$3.26</strong>
              </div>
              <div className={`${styles.shopifyPaymentRowClean} ${styles.shopifyPaymentTotalRow}`}>
                <span>Total</span>
                <span></span>
                <strong>{formatOrderMoney(order.total + 8 + 3.26)}</strong>
              </div>
              <div className={`${styles.shopifyPaymentRowClean} ${styles.shopifyPaymentPaidRow}`}>
                <span>Paid</span>
                <span></span>
                <strong>{order.paymentStatus === 'paid' ? formatOrderMoney(order.total + 8 + 3.26) : '$0.00'}</strong>
              </div>
            </div>
          </div>

          <div className={styles.shopifyPanelClean}>
            <div className={styles.sectionCardHeader}>
              <h3>Metafields</h3>
              <button className={styles.inlineLinkButton} type="button">View all</button>
            </div>
            <p className={styles.cardSubtext}>No metafields pinned</p>
          </div>

          <div className={styles.timelineSectionClean}>
            <div className={styles.sectionCardHeader}>
              <h3>Timeline</h3>
            </div>
            <div className={styles.shopifyCommentBoxClean}>Leave a comment…</div>
            <div className={styles.timelineListClean}>
              {(order.timeline || []).map(entry => (
                <div key={entry.id} className={styles.timelineRowClean}>
                  <div className={styles.timelineAvatar}>DP</div>
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineHeaderRow}>
                      <strong>{entry.event}</strong>
                      <small>{formatTimelineDate(entry.createdAt)}</small>
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
            <div className={styles.sectionCardHeader}>
              <h3>Notes</h3>
              <button className={styles.textActionButton} type="button">✎</button>
            </div>
            <textarea className={styles.notesInput} onChange={event => onUpdateOrder(order.id, currentOrder => ({ ...currentOrder, notes: event.target.value }))} rows={4} value={order.notes} />
          </div>

          <div className={styles.shopifySidePanelClean}>
            <div className={styles.sectionCardHeader}>
              <h3>Additional details</h3>
              <button className={styles.textActionButton} type="button">✎</button>
            </div>
            <div className={styles.infoListTight}>
              <div>#{shippingLabelDraft.packageType} ({shippingLabelDraft.weight})</div>
              <div>{order.lineItems.map(item => item.title).join(', ')}</div>
              <div>Ship from {settings.shippingOrigin}</div>
            </div>
            <div className={styles.shippingBuilderGridCompact}>
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
              <button className={styles.secondaryAction} onClick={buyShippingLabel} type="button">Buy label</button>
              <button className={styles.secondaryAction} type="button">Packing slip</button>
            </div>
          </div>

          <div className={styles.shopifySidePanelClean}>
            <div className={styles.sectionCardHeader}>
              <h3>Customer</h3>
              <button className={styles.textActionButton} type="button">•••</button>
            </div>
            <div className={styles.infoListTight}>
              <a className={styles.customerLink} href={`mailto:${order.customer.email}`}>{order.customer.name}</a>
              <a className={styles.customerLink} href={`mailto:${order.customer.email}`}>{order.customer.email}</a>
            </div>
            <div className={styles.addressList}>
              <div className={styles.addressBlock}>
                <strong>Shipping address</strong>
                <p>{order.shippingAddress}</p>
              </div>
              <div className={styles.addressBlock}>
                <strong>Billing address</strong>
                <p>{order.billingAddress}</p>
              </div>
            </div>
          </div>

          <div className={styles.shopifySidePanelClean}>
            <div className={styles.sectionCardHeader}>
              <h3>Tags</h3>
            </div>
            <div className={styles.tagComposer}>
              <div className={styles.tagList}>
                {order.tags.map(tag => (
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
