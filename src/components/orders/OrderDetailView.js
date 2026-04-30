"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatOrderMoney } from '../../lib/ordersData';
import OrderAdjustmentsCard from './OrderAdjustmentsCard';
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

function fulfilledQuantityByOrderItem(order) {
  const quantities = new Map();
  const fulfillments = order.fulfillments || [];

  for (const fulfillment of fulfillments) {
    const status = String(fulfillment.status || '').toUpperCase();
    if (['CANCELLED', 'ERROR', 'FAILURE'].includes(status)) {
      continue;
    }

    for (const item of fulfillment.items || []) {
      quantities.set(item.orderItemId, (quantities.get(item.orderItemId) || 0) + Number(item.quantity || 0));
    }
  }

  return quantities;
}

function buildManualFulfillmentItems(order) {
  const fulfilledByItem = fulfilledQuantityByOrderItem(order);
  return lineItemsForOrder(order).map((item) => {
    const ordered = Number(item.quantity || 0);
    const fulfilled = fulfilledByItem.get(item.id) || 0;
    const remaining = Math.max(0, ordered - fulfilled);
    return {
      ...item,
      selected: false,
      fulfillQty: remaining > 0 ? 1 : 0,
      maxFulfillable: remaining,
      alreadyFulfilled: fulfilled,
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

function ManualFulfillmentPanel({ order, onClose, onSuccess }) {
  const [selectedItems, setSelectedItems] = useState(buildManualFulfillmentItems(order));
  const [carrier, setCarrier] = useState('');
  const [service, setService] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [shippedDate, setShippedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sendTrackingEmail, setSendTrackingEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();

    const items = selectedItems
      .filter(item => item.selected)
      .map(item => ({
        orderItemId: item.id,
        variantId: lineItemVariantId(item),
        quantity: parseInt(item.fulfillQty, 10) || 0,
      }));

    if (!items.length) {
      setError('Select at least one item to fulfill');
      return;
    }

    if (items.some(item => item.quantity <= 0)) {
      setError('Fulfillment quantities must be at least 1');
      return;
    }

    const overLimitItem = selectedItems.find(item => item.selected && (parseInt(item.fulfillQty, 10) || 0) > Number(item.maxFulfillable || 0));
    if (overLimitItem) {
      setError('One or more selected items exceed the remaining fulfillable quantity');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${normalizeOrderNumber(order.orderNumber)}/manual-fulfillment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier: carrier || undefined,
          service: service || undefined,
          trackingNumber: trackingNumber || undefined,
          trackingUrl: trackingUrl || undefined,
          shippedDate: shippedDate ? new Date(`${shippedDate}T12:00:00.000Z`).toISOString() : undefined,
          sendTrackingEmail,
          items,
        }),
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to create manual fulfillment');
      }

      onSuccess(
        'Order fulfilled manually',
        `${items.length} item${items.length === 1 ? '' : 's'} fulfilled${trackingNumber ? ` with tracking ${trackingNumber}` : ''}.`
      );
    } catch (fulfillmentError) {
      setError(fulfillmentError instanceof Error ? fulfillmentError.message : 'Failed to create manual fulfillment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.shopifyPanelClean} style={{ border: '2px solid #e3e3e3', marginBottom: 16 }}>
      <div className={styles.shopifyPanelHeaderClean}>
        <strong>Mark fulfilled manually</strong>
        <button className={styles.textActionButton} onClick={onClose} type="button">Close</button>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selectedItems.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                checked={item.selected}
                disabled={item.maxFulfillable <= 0}
                onChange={() => setSelectedItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, selected: !entry.selected } : entry)))}
                type="checkbox"
              />
              <span style={{ flex: 1 }}>
                {lineItemTitle(item)}{lineItemVariantTitle(item) ? ` - ${lineItemVariantTitle(item)}` : ''}
              </span>
              <span style={{ color: '#666', width: 130, textAlign: 'right' }}>
                Remaining: {item.maxFulfillable}
              </span>
              <input
                className={styles.detailInput}
                disabled={!item.selected || item.maxFulfillable <= 0}
                max={item.maxFulfillable}
                min="1"
                onChange={(event) => setSelectedItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, fulfillQty: event.target.value } : entry)))}
                style={{ width: 74 }}
                type="number"
                value={item.fulfillQty}
              />
            </div>
          ))}
        </div>
        <label style={{ fontSize: 13 }}>
          Carrier
          <input className={styles.detailInput} onChange={(event) => setCarrier(event.target.value)} type="text" value={carrier} />
        </label>
        <label style={{ fontSize: 13 }}>
          Service
          <input className={styles.detailInput} onChange={(event) => setService(event.target.value)} type="text" value={service} />
        </label>
        <label style={{ fontSize: 13 }}>
          Tracking number
          <input className={styles.detailInput} onChange={(event) => setTrackingNumber(event.target.value)} type="text" value={trackingNumber} />
        </label>
        <label style={{ fontSize: 13 }}>
          Tracking URL
          <input className={styles.detailInput} onChange={(event) => setTrackingUrl(event.target.value)} type="url" value={trackingUrl} />
        </label>
        <label style={{ fontSize: 13 }}>
          Shipped date
          <input className={styles.detailInput} onChange={(event) => setShippedDate(event.target.value)} type="date" value={shippedDate} />
        </label>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input checked={sendTrackingEmail} onChange={(event) => setSendTrackingEmail(event.target.checked)} type="checkbox" />
          Send tracking email when configured
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.primaryAction} disabled={submitting} type="submit">
            {submitting ? 'Saving fulfillment...' : 'Save manual fulfillment'}
          </button>
          <button className={styles.secondaryAction} disabled={submitting} onClick={onClose} type="button">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function LabelPurchasePanel({ order, onClose, onSuccess }) {
  const [selectedItems, setSelectedItems] = useState(buildManualFulfillmentItems(order));
  const [packageWeightOz, setPackageWeightOz] = useState('12');
  const [packageLengthIn, setPackageLengthIn] = useState('10');
  const [packageWidthIn, setPackageWidthIn] = useState('8');
  const [packageHeightIn, setPackageHeightIn] = useState('4');
  const [labelFormat, setLabelFormat] = useState('PDF');
  const [labelSize, setLabelSize] = useState('4x6');
  const [rates, setRates] = useState([]);
  const [selectedRateId, setSelectedRateId] = useState('');
  const [labelResult, setLabelResult] = useState(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [buyingLabel, setBuyingLabel] = useState(false);
  const [error, setError] = useState(null);

  function buildSelectedItemsPayload() {
    return selectedItems
      .filter(item => item.selected)
      .map(item => ({
        orderItemId: item.id,
        variantId: lineItemVariantId(item),
        quantity: parseInt(item.fulfillQty, 10) || 0,
      }));
  }

  function buildParcelPayload() {
    return {
      weightOz: Number(packageWeightOz),
      lengthIn: Number(packageLengthIn),
      widthIn: Number(packageWidthIn),
      heightIn: Number(packageHeightIn),
    };
  }

  function validateSelection() {
    const items = buildSelectedItemsPayload();
    if (!items.length) {
      setError('Select at least one item to ship');
      return null;
    }
    if (items.some(item => item.quantity <= 0)) {
      setError('Selected quantities must be at least 1');
      return null;
    }
    const overLimitItem = selectedItems.find(item => item.selected && (parseInt(item.fulfillQty, 10) || 0) > Number(item.maxFulfillable || 0));
    if (overLimitItem) {
      setError('One or more selected items exceed the remaining fulfillable quantity');
      return null;
    }

    const parcel = buildParcelPayload();
    if (!Number.isFinite(parcel.weightOz) || parcel.weightOz <= 0) {
      setError('Package weight must be greater than zero');
      return null;
    }
    if (!Number.isFinite(parcel.lengthIn) || parcel.lengthIn <= 0 || !Number.isFinite(parcel.widthIn) || parcel.widthIn <= 0 || !Number.isFinite(parcel.heightIn) || parcel.heightIn <= 0) {
      setError('Package dimensions must be greater than zero');
      return null;
    }

    return { items, parcel };
  }

  async function handleLoadRates() {
    const payload = validateSelection();
    if (!payload) return;

    setLoadingRates(true);
    setError(null);
    setLabelResult(null);
    try {
      const response = await fetch(`/api/orders/${normalizeOrderNumber(order.orderNumber)}/shipping-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to load label rates');
      }

      const nextRates = Array.isArray(json.data?.quotes) ? json.data.quotes : [];
      if (!nextRates.length) {
        throw new Error('No rates were returned for this package');
      }
      setRates(nextRates);
      setSelectedRateId(nextRates[0].providerRateId || nextRates[0].id || '');
    } catch (ratesError) {
      setRates([]);
      setSelectedRateId('');
      setError(ratesError instanceof Error ? ratesError.message : 'Failed to load rates');
    } finally {
      setLoadingRates(false);
    }
  }

  async function handleBuyLabel() {
    const payload = validateSelection();
    if (!payload) return;
    if (!selectedRateId) {
      setError('Select a rate before buying a label');
      return;
    }

    setBuyingLabel(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${normalizeOrderNumber(order.orderNumber)}/shipping-labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          providerRateId: selectedRateId,
          labelFormat,
          labelSize,
        }),
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to buy shipping label');
      }

      setLabelResult(json.data);
      if (json.data?.shippingLabel?.labelUrl) {
        window.open(json.data.shippingLabel.labelUrl, '_blank', 'noopener,noreferrer');
      }

      onSuccess(
        json.data?.duplicate ? 'Shipping label reused' : 'Shipping label purchased',
        json.data?.shippingLabel?.trackingNumber
          ? `Tracking ${json.data.shippingLabel.trackingNumber} saved on fulfillment.`
          : 'Label purchased and fulfillment updated.'
      );
    } catch (labelError) {
      setError(labelError instanceof Error ? labelError.message : 'Failed to buy label');
    } finally {
      setBuyingLabel(false);
    }
  }

  return (
    <div className={styles.shopifyPanelClean} style={{ border: '2px solid #e3e3e3', marginBottom: 16 }}>
      <div className={styles.shopifyPanelHeaderClean}>
        <strong>Buy shipping label</strong>
        <button className={styles.textActionButton} onClick={onClose} type="button">Close</button>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selectedItems.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                checked={item.selected}
                disabled={item.maxFulfillable <= 0}
                onChange={() => {
                  setRates([]);
                  setSelectedRateId('');
                  setSelectedItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, selected: !entry.selected } : entry)));
                }}
                type="checkbox"
              />
              <span style={{ flex: 1 }}>
                {lineItemTitle(item)}{lineItemVariantTitle(item) ? ` - ${lineItemVariantTitle(item)}` : ''}
              </span>
              <span style={{ color: '#666', width: 130, textAlign: 'right' }}>
                Remaining: {item.maxFulfillable}
              </span>
              <input
                className={styles.detailInput}
                disabled={!item.selected || item.maxFulfillable <= 0}
                max={item.maxFulfillable}
                min="1"
                onChange={(event) => {
                  setRates([]);
                  setSelectedRateId('');
                  setSelectedItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, fulfillQty: event.target.value } : entry)));
                }}
                style={{ width: 74 }}
                type="number"
                value={item.fulfillQty}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
          <label style={{ fontSize: 13 }}>
            Weight (oz)
            <input className={styles.detailInput} min="1" onChange={(event) => { setPackageWeightOz(event.target.value); setRates([]); setSelectedRateId(''); }} type="number" value={packageWeightOz} />
          </label>
          <label style={{ fontSize: 13 }}>
            Length (in)
            <input className={styles.detailInput} min="1" onChange={(event) => { setPackageLengthIn(event.target.value); setRates([]); setSelectedRateId(''); }} type="number" value={packageLengthIn} />
          </label>
          <label style={{ fontSize: 13 }}>
            Width (in)
            <input className={styles.detailInput} min="1" onChange={(event) => { setPackageWidthIn(event.target.value); setRates([]); setSelectedRateId(''); }} type="number" value={packageWidthIn} />
          </label>
          <label style={{ fontSize: 13 }}>
            Height (in)
            <input className={styles.detailInput} min="1" onChange={(event) => { setPackageHeightIn(event.target.value); setRates([]); setSelectedRateId(''); }} type="number" value={packageHeightIn} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
          <label style={{ fontSize: 13 }}>
            Label format
            <select className={styles.detailSelect} onChange={(event) => setLabelFormat(event.target.value)} value={labelFormat}>
              <option value="PDF">PDF</option>
              <option value="PNG">PNG</option>
              <option value="ZPL">ZPL</option>
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            Label size
            <select className={styles.detailSelect} onChange={(event) => setLabelSize(event.target.value)} value={labelSize}>
              <option value="4x6">4x6</option>
              <option value="8.5x11">8.5x11</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={styles.secondaryAction} disabled={loadingRates} onClick={handleLoadRates} type="button">
            {loadingRates ? 'Loading rates...' : 'Get rates'}
          </button>
        </div>

        {rates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rates.map(rate => {
              const rateId = rate.providerRateId || rate.id;
              return (
                <label key={rate.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid #e4e4e4', borderRadius: 10, padding: 10 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input checked={selectedRateId === rateId} onChange={() => setSelectedRateId(rateId)} type="radio" />
                    <span>{rate.displayName}</span>
                  </span>
                  <strong>{formatOrderMoney((Number(rate.amountCents || 0) / 100))}</strong>
                </label>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.primaryAction} disabled={buyingLabel || !selectedRateId} onClick={handleBuyLabel} type="button">
            {buyingLabel ? 'Buying label...' : 'Buy shipping label'}
          </button>
          <button className={styles.secondaryAction} disabled={buyingLabel} onClick={onClose} type="button">Cancel</button>
        </div>

        {labelResult?.shippingLabel?.labelUrl && (
          <a href={labelResult.shippingLabel.labelUrl} rel="noreferrer" style={{ fontSize: 13 }} target="_blank">
            Open label PDF
          </a>
        )}
      </div>
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
  const canManualFulfill =
    ['PAID', 'PARTIALLY_REFUNDED'].includes(normalizePaymentStatus(currentOrder.paymentStatus)) &&
    normalizePaymentStatus(currentOrder.fulfillmentStatus) !== 'FULFILLED';
  const canBuyShippingLabel = ['PAID', 'PARTIALLY_REFUNDED'].includes(normalizePaymentStatus(currentOrder.paymentStatus));
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
          <button className={styles.secondaryAction} disabled={!canManualFulfill} onClick={() => setActivePanel(activePanel === 'manual-fulfillment' ? null : 'manual-fulfillment')} type="button">Mark Fulfilled Manually</button>
          <button className={styles.secondaryAction} disabled={!canBuyShippingLabel} onClick={() => setActivePanel(activePanel === 'label-purchase' ? null : 'label-purchase')} type="button">Buy Shipping Label</button>
          <button className={styles.secondaryAction} type="button">Print</button>
        </div>
      </div>

      {activePanel === 'manual-fulfillment' && <ManualFulfillmentPanel order={currentOrder} onClose={() => setActivePanel(null)} onSuccess={handlePanelSuccess} />}
      {activePanel === 'label-purchase' && <LabelPurchasePanel order={currentOrder} onClose={() => setActivePanel(null)} onSuccess={handlePanelSuccess} />}

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

          <OrderAdjustmentsCard
            onOrderRefresh={refreshOrder}
            orderNumber={currentOrder.orderNumber}
            paymentStatus={currentOrder.paymentStatus}
          />

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
