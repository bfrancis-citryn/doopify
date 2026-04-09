"use client";

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { formatOrderMoney } from '../../lib/ordersData';
import styles from './OrdersWorkspace.module.css';

function StatusPill({ children, tone }) {
  return <span className={`${styles.statusPill} ${styles[`tone_${tone}`]}`}>{children}</span>;
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
    return null;
  }

  return (
    <div className={styles.orderDetailPage}>
      <div className={styles.orderDetailBreadcrumbs}>
        <Link className={styles.inlineLinkButton} href="/orders">
          ← Back to orders
        </Link>
      </div>

      <div className={styles.shopifyOrderShell}>
        <div className={styles.shopifyOrderHeader}>
          <div>
            <div className={styles.shopifyOrderTitleRow}>
              <h2 className={styles.detailTitle}>{order.orderNumber}</h2>
              <StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill>
              <StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill>
            </div>
            <p className={styles.shopifyOrderMeta}>Created {new Date(order.createdAt).toLocaleString()} from {order.channel}</p>
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
                <StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill>
                <strong>{order.orderNumber}-F1</strong>
              </div>

              <div className={styles.fulfillmentCard}>
                <StatusPill tone={order.deliveryStatus.replace(/\s+/g, '-')}>{order.deliveryStatus}</StatusPill>
                <div className={styles.fulfillmentMetaList}>
                  <div>{new Date(order.createdAt).toLocaleDateString()}</div>
                  <div>Ship from {settings.shippingOrigin}</div>
                  <div>{order.carrier} tracking: {order.trackingNumber || 'No tracking yet'}</div>
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
                {order.lineItems.map(item => (
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
                <StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill>
              </div>
              <div className={styles.paymentSummaryTable}>
                <div><span>Subtotal</span><strong>{formatOrderMoney(order.total)}</strong></div>
                <div><span>Discount</span><strong>{order.tags.includes('Draft converted') ? '- Custom discount' : '—'}</strong></div>
                <div className={styles.totalRow}><span>Total</span><strong>{formatOrderMoney(order.total)}</strong></div>
                <div><span>Paid</span><strong>{order.paymentStatus === 'paid' ? formatOrderMoney(order.total) : '$0.00'}</strong></div>
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
                {(order.timeline || []).map(entry => (
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
              <textarea className={styles.notesInput} onChange={event => onUpdateOrder(order.id, currentOrder => ({ ...currentOrder, notes: event.target.value }))} rows={4} value={order.notes} />
            </div>

            <div className={styles.detailSection}>
              <div className={styles.sectionCardHeader}><h3>Customer</h3><button className={styles.inlineLinkButton} type="button">•••</button></div>
              <p>{order.customer.name}</p>
              <small>{order.customer.email}</small>
              <div className={styles.customerBlockSpacing}>
                <strong>Shipping address</strong>
                <p>{order.shippingAddress}</p>
              </div>
              <div className={styles.customerBlockSpacing}>
                <strong>Billing address</strong>
                <p>{order.billingAddress}</p>
              </div>
            </div>

            <div className={styles.detailSection}>
              <h3>Conversion summary</h3>
              <p>{order.channel === 'Draft Orders' ? 'This order was converted from a draft order.' : "There aren't any conversion details available for this order."}</p>
            </div>

            <div className={styles.detailSection}>
              <h3>Order risk</h3>
              <p>{order.riskLevel === 'medium' ? 'Review recommended before fulfillment.' : 'Analysis not available.'}</p>
            </div>

            <div className={styles.detailSection}>
              <h3>Tags</h3>
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
                  <button className={styles.secondaryAction} onClick={addTagToOrder} type="button">Add tag</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
