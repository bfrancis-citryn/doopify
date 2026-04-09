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

export default function OrderDetailView({ order, onUpdateOrder }) {
  const { settings } = useSettings();
  const [tagInput, setTagInput] = useState('');
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
            ← Back to orders
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

      <div className={styles.shopifyOrderHeaderSlim}>
        <div className={styles.orderIdentityBlock}>
          <div className={styles.shopifyOrderTitleRow}>
            <h1 className={styles.detailTitle}>{order.orderNumber}</h1>
            <StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill>
            <StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill>
          </div>
          <p className={styles.shopifyOrderMeta}>Created {new Date(order.createdAt).toLocaleString()} from {order.channel}</p>
        </div>
        <div className={styles.orderHeaderActions}>
          <button className={styles.secondaryAction} type="button">Refund</button>
          <button className={styles.secondaryAction} type="button">Return</button>
          <button className={styles.secondaryAction} type="button">Edit</button>
          <button className={styles.secondaryAction} type="button">Print</button>
          <button className={styles.primaryAction} type="button">More actions</button>
        </div>
      </div>

      <div className={styles.shopifyDetailLayoutClean}>
        <div className={styles.shopifyMainColumn}>
          <div className={styles.shopifyCard}>
            <div className={styles.shopifyCardHeaderInline}>
              <div className={styles.sectionPillRow}>
                <StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill>
                <strong>{order.orderNumber}-F1</strong>
              </div>
              <button className={styles.textActionButton} type="button">•••</button>
            </div>

            <div className={styles.shopifyInsetCard}>
              <div className={styles.sectionPillRow}>
                <StatusPill tone={order.deliveryStatus.replace(/\s+/g, '-')}>{order.deliveryStatus}</StatusPill>
              </div>
              <div className={styles.infoList}>
                <div>{new Date(order.createdAt).toLocaleDateString()}</div>
                <div>Deliver via {order.carrier}</div>
                <div>{order.trackingNumber ? `${order.carrier} tracking: ${order.trackingNumber}` : 'No tracking number yet'}</div>
              </div>
            </div>

            <div className={styles.shopifyLineItemCompactList}>
              {order.lineItems.map(item => (
                <div key={item.id} className={styles.shopifyLineItemCompactRow}>
                  <div className={styles.shopifyLineItemThumb} />
                  <div className={styles.shopifyLineItemInfo}>
                    <strong>{item.title}</strong>
                    <small className={styles.lineItemSubtext}>{item.variant}</small>
                  </div>
                  <div className={styles.shopifyQtyBadge}>{item.quantity}</div>
                  <div className={styles.shopifyLineItemTotal}>{formatOrderMoney(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.shopifyCard}>
            <div className={styles.shopifyCardHeaderInline}>
              <div className={styles.sectionPillRow}>
                <StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill>
              </div>
            </div>

            <div className={styles.shopifyTotalsCard}>
              <div className={styles.infoRow}><span>Subtotal</span><strong>{formatOrderMoney(order.total)}</strong></div>
              <div className={styles.infoRow}><span>Shipping</span><strong>—</strong></div>
              <div className={styles.infoRow}><span>Taxes</span><strong>—</strong></div>
              <div className={`${styles.infoRow} ${styles.totalRow}`}><span>Total</span><strong>{formatOrderMoney(order.total)}</strong></div>
              <div className={styles.infoRow}><span>Paid</span><strong>{order.paymentStatus === 'paid' ? formatOrderMoney(order.total) : '$0.00'}</strong></div>
            </div>
          </div>

          <div className={styles.shopifyCard}>
            <div className={styles.sectionCardHeader}>
              <h3>Metafields</h3>
              <button className={styles.inlineLinkButton} type="button">View all</button>
            </div>
            <p className={styles.cardSubtext}>No metafields pinned</p>
          </div>

          <div className={styles.timelineSection}>
            <h3>Timeline</h3>
            <div className={styles.shopifyCommentBox}>Leave a comment…</div>
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

        <div className={styles.shopifySideColumn}>
          <div className={styles.shopifySideCard}>
            <div className={styles.sectionCardHeader}>
              <h3>Notes</h3>
              <button className={styles.inlineLinkButton} type="button">Edit</button>
            </div>
            <textarea className={styles.notesInput} onChange={event => onUpdateOrder(order.id, currentOrder => ({ ...currentOrder, notes: event.target.value }))} rows={4} value={order.notes} />
          </div>

          <div className={styles.shopifySideCard}>
            <div className={styles.sectionCardHeader}>
              <h3>Additional details</h3>
              <button className={styles.inlineLinkButton} type="button">Edit</button>
            </div>
            <div className={styles.infoList}>
              <div>{shippingLabelDraft.packageType}</div>
              <div>{shippingLabelDraft.weight}</div>
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

          <div className={styles.shopifySideCard}>
            <div className={styles.sectionCardHeader}>
              <h3>Customer</h3>
              <button className={styles.textActionButton} type="button">•••</button>
            </div>
            <div className={styles.infoList}>
              <strong>{order.customer.name}</strong>
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

          <div className={styles.shopifySideCard}>
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
