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
          ← Back to orders
        </Link>
      </div>

      <div className={styles.orderDetailHeaderBand}>
        <div className={styles.orderDetailHeaderCopy}>
          <span className={styles.ordersEyebrow}>Order detail</span>
          <h1>{order.orderNumber}</h1>
          <p>Review fulfillment, payment status, customer history, and timeline activity in one clean workflow.</p>
        </div>
        <div className={styles.orderHeaderActions}>
          <button className={styles.secondaryAction} type="button">Duplicate</button>
          <button className={styles.primaryAction} type="button">Create fulfillment</button>
        </div>
      </div>

      <div className={styles.shopifyOrderShell}>
        <div className={styles.shopifyOrderHeader}>
          <div className={styles.orderActionBar}>
            <div>
              <div className={styles.shopifyOrderTitleRow}>
                <h2 className={styles.detailTitle}>{order.orderNumber}</h2>
                <StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill>
                <StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill>
                <StatusPill tone={order.deliveryStatus.replace(/\s+/g, '-')}>{order.deliveryStatus}</StatusPill>
              </div>
              <div className={styles.orderHeaderMeta}>
                <span className={styles.shopifyOrderMeta}>Created {new Date(order.createdAt).toLocaleString()}</span>
                <span className={styles.shopifyOrderMeta}>Source: {order.channel}</span>
                <span className={styles.shopifyOrderMeta}>Location: {order.location}</span>
              </div>
            </div>
            <div className={styles.detailActions}>
              <button className={styles.secondaryAction} type="button">Restock</button>
              <button className={styles.secondaryAction} type="button">Return</button>
              <button className={styles.secondaryAction} type="button">Edit</button>
              <button className={styles.secondaryAction} type="button">Print</button>
              <button className={styles.primaryAction} type="button">More actions</button>
            </div>
          </div>

          <div className={styles.orderStatsGrid}>
            <div className={styles.summaryCard}>
              <span>Total collected</span>
              <strong>{formatOrderMoney(order.total)}</strong>
              <p className={styles.orderStatMeta}>{order.paymentStatus === 'paid' ? 'Captured successfully' : 'Awaiting capture'}</p>
            </div>
            <div className={styles.summaryCard}>
              <span>Items</span>
              <strong>{order.itemCount}</strong>
              <p className={styles.orderStatMeta}>{order.deliveryMethod}</p>
            </div>
            <div className={styles.summaryCard}>
              <span>Risk level</span>
              <strong>{order.riskLevel}</strong>
              <p className={styles.orderStatMeta}>{order.riskLevel === 'medium' ? 'Manual review suggested' : 'No issues flagged'}</p>
            </div>
            <div className={styles.summaryCard}>
              <span>Tracking</span>
              <strong>{order.trackingNumber || 'Pending'}</strong>
              <p className={styles.orderStatMeta}>{order.carrier}</p>
            </div>
          </div>
        </div>

        <div className={styles.shopifyDetailLayout}>
          <div className={styles.shopifyMainColumn}>
            <div className={`${styles.detailSection} ${styles.detailSectionTight}`}>
              <div className={styles.fulfillmentHeader}>
                <div>
                  <h3>Fulfillment</h3>
                  <p className={styles.fulfillmentMetaMuted}>Build the shipping workflow here instead of cramming it into the order list.</p>
                </div>
                <div className={styles.sectionPillRow}>
                  <StatusPill tone={order.fulfillmentStatus.replace(/\s+/g, '-')}>{order.fulfillmentStatus}</StatusPill>
                  <strong>{order.orderNumber}-F1</strong>
                </div>
              </div>

              <div className={styles.fulfillmentCard}>
                <div className={styles.fulfillmentHeader}>
                  <div>
                    <StatusPill tone={order.deliveryStatus.replace(/\s+/g, '-')}>{order.deliveryStatus}</StatusPill>
                  </div>
                  <span className={styles.fulfillmentMetaMuted}>{order.deliveryMethod}</span>
                </div>
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
            </div>

            <div className={`${styles.detailSection} ${styles.detailSectionTight}`}>
              <div className={styles.lineItemHeader}>
                <div>
                  <h3>Items</h3>
                  <p className={styles.fulfillmentMetaMuted}>Everything in the order, grouped into one clear card.</p>
                </div>
                <button className={styles.inlineLinkButton} type="button">Edit items</button>
              </div>
              <div className={styles.lineItemList}>
                {order.lineItems.map(item => (
                  <div key={item.id} className={styles.shopifyLineItemRow}>
                    <div className={styles.shopifyLineItemThumb} />
                    <div className={styles.shopifyLineItemInfo}>
                      <strong>{item.title}</strong>
                      <small className={styles.lineItemSubtext}>{item.variant}</small>
                    </div>
                    <div className={styles.shopifyLineItemPrice}>{formatOrderMoney(item.price)} × {item.quantity}</div>
                    <div className={styles.shopifyLineItemTotal}>{formatOrderMoney(item.price * item.quantity)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${styles.detailSection} ${styles.detailSectionTight}`}>
              <div className={styles.paymentHeader}>
                <div>
                  <h3>Payment</h3>
                  <p className={styles.fulfillmentMetaMuted}>High-level totals with room for real payment records later.</p>
                </div>
                <StatusPill tone={order.paymentStatus.replace(/\s+/g, '-')}>{order.paymentStatus}</StatusPill>
              </div>
              <div className={styles.paymentSummaryTable}>
                <div><span>Subtotal</span><strong>{formatOrderMoney(order.total)}</strong></div>
                <div><span>Discount</span><strong>{order.tags.includes('Draft converted') ? '- Custom discount' : '—'}</strong></div>
                <div><span>Shipping</span><strong>Included</strong></div>
                <div className={styles.totalRow}><span>Total</span><strong>{formatOrderMoney(order.total)}</strong></div>
                <div><span>Paid</span><strong>{order.paymentStatus === 'paid' ? formatOrderMoney(order.total) : '$0.00'}</strong></div>
              </div>
            </div>

            <div className={`${styles.detailSection} ${styles.detailSectionTight}`}>
              <div className={styles.sectionCardHeader}><h3>Timeline</h3><button className={styles.inlineLinkButton} type="button">Add comment</button></div>
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
            <div className={`${styles.detailSection} ${styles.detailSectionTight}`}>
              <div className={styles.sidebarCardHeader}>
                <div>
                  <h3>Customer</h3>
                  <p className={styles.cardSubtext}>Contact and address details.</p>
                </div>
                <button className={styles.inlineLinkButton} type="button">•••</button>
              </div>
              <div className={styles.customerSummaryCard}>
                <strong>{order.customer.name}</strong>
                <small>{order.customer.email}</small>
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

            <div className={`${styles.detailSection} ${styles.detailSectionTight}`}>
              <div className={styles.sidebarCardHeader}>
                <div>
                  <h3>Notes</h3>
                  <p className={styles.cardSubtext}>Internal order notes for staff.</p>
                </div>
                <button className={styles.inlineLinkButton} type="button">Edit</button>
              </div>
              <textarea className={styles.notesInput} onChange={event => onUpdateOrder(order.id, currentOrder => ({ ...currentOrder, notes: event.target.value }))} rows={5} value={order.notes} />
            </div>

            <div className={`${styles.detailSection} ${styles.detailSectionTight}`}>
              <h3>Order context</h3>
              <div className={styles.infoList}>
                <div className={styles.infoRow}><span>Conversion summary</span><strong>{order.channel === 'Draft Orders' ? 'Converted from draft' : 'Direct order'}</strong></div>
                <div className={styles.infoRow}><span>Risk</span><strong>{order.riskLevel === 'medium' ? 'Review recommended' : 'No flags'}</strong></div>
                <div className={styles.infoRow}><span>Delivery method</span><strong>{order.deliveryMethod}</strong></div>
              </div>
            </div>

            <div className={`${styles.detailSection} ${styles.detailSectionTight}`}>
              <div className={styles.sidebarCardHeader}>
                <div>
                  <h3>Tags</h3>
                  <p className={styles.cardSubtext}>Useful flags for triage and workflows.</p>
                </div>
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
