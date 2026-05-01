"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminButton from "../admin/ui/AdminButton";
import AdminCard from "../admin/ui/AdminCard";
import AdminEmptyState from "../admin/ui/AdminEmptyState";
import AdminField from "../admin/ui/AdminField";
import AdminInput from "../admin/ui/AdminInput";
import AdminStatusChip from "../admin/ui/AdminStatusChip";
import AdminTextarea from "../admin/ui/AdminTextarea";
import OrderAdjustmentsCard from "./OrderAdjustmentsCard";
import styles from "./OrderDetailView.module.css";

function normalizeOrderNumber(orderNumber) {
  return String(orderNumber || "").replace(/^#/, "");
}

export function orderStatusChipTone(status) {
  const normalized = String(status || "").toUpperCase();
  if (["PAID", "FULFILLED", "OPEN", "DELIVERED", "SUCCESS"].includes(normalized)) return "success";
  if (["FAILED", "VOIDED", "CANCELLED", "DECLINED", "EXHAUSTED", "CLOSED"].includes(normalized)) return "danger";
  if (["PENDING", "PARTIALLY_REFUNDED", "PARTIALLY_FULFILLED", "UNFULFILLED", "IN_TRANSIT", "REQUESTED", "RECEIVED"].includes(normalized)) return "warning";
  return "neutral";
}

function formatMoney(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatAddress(address) {
  if (!address) return "Not provided";

  if (typeof address === "string") {
    return address.trim() || "Not provided";
  }

  const text = [
    address.firstName && address.lastName
      ? `${address.firstName} ${address.lastName}`
      : address.firstName || address.lastName || "",
    address.company,
    address.address1,
    address.address2,
    [address.city, address.province, address.postalCode].filter(Boolean).join(", "),
    address.country,
    address.phone ? `Phone: ${address.phone}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return text || "Not provided";
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className={styles.summaryRow}>
      <span>{label}</span>
      <strong className={strong ? styles.summaryStrong : ""}>{value}</strong>
    </div>
  );
}

function parseErrorMessage(json, fallback) {
  if (json?.error && typeof json.error === "string") return json.error;
  return fallback;
}

export default function OrderDetailView({ order }) {
  const [liveOrder, setLiveOrder] = useState(order);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [ratesLoading, setRatesLoading] = useState(false);
  const [buyingLabel, setBuyingLabel] = useState(false);
  const [creatingManual, setCreatingManual] = useState(false);
  const [rateQuotes, setRateQuotes] = useState([]);
  const [rateProvider, setRateProvider] = useState("");
  const [selectedRateId, setSelectedRateId] = useState("");
  const [selectedQuantities, setSelectedQuantities] = useState({});
  const [parcel, setParcel] = useState({
    weightOz: "12",
    lengthIn: "10",
    widthIn: "8",
    heightIn: "4",
  });
  const [manualForm, setManualForm] = useState({
    carrier: "",
    service: "",
    trackingNumber: "",
    trackingUrl: "",
    sendTrackingEmail: false,
  });
  const [internalNoteDraft, setInternalNoteDraft] = useState("");
  const [customerNoteDraft, setCustomerNoteDraft] = useState("");
  const [sendCustomerNoteEmail, setSendCustomerNoteEmail] = useState(false);
  const [savingInternalNote, setSavingInternalNote] = useState(false);
  const [savingCustomerNote, setSavingCustomerNote] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState("");

  useEffect(() => {
    setLiveOrder(order);
  }, [order]);

  const currentOrder = liveOrder || order;
  const currency = currentOrder?.currency || "USD";
  const lineItems = currentOrder?.lineItems || [];
  const fulfillments = currentOrder?.fulfillments || [];
  const shippingLabels = currentOrder?.shippingLabels || [];
  const discounts = currentOrder?.discounts || currentOrder?.discountApplications || [];
  const customerVisibleNotes = currentOrder?.customerVisibleNotes || [];
  const timeline = currentOrder?.timeline || [];
  const shippingAddress = currentOrder?.shippingSummary?.address || currentOrder?.shippingAddress || null;
  const billingAddress = currentOrder?.billingAddress || null;
  const shippingCapabilities = currentOrder?.shippingCapabilities || {};
  const labelProviderConnected = Boolean(shippingCapabilities.providerConnected);
  const canBuyShippingLabel = Boolean(currentOrder?.availableActions?.canBuyShippingLabel);

  useEffect(() => {
    setInternalNoteDraft(currentOrder?.notes || "");
    setCustomerNoteDraft("");
    setSendCustomerNoteEmail(false);
  }, [currentOrder?.id, currentOrder?.notes]);

  const chips = useMemo(
    () => [
      {
        key: "payment",
        label: currentOrder?.paymentStatusRaw || currentOrder?.paymentStatus || "unknown",
      },
      {
        key: "fulfillment",
        label: currentOrder?.fulfillmentStatusRaw || currentOrder?.fulfillmentStatus || "unknown",
      },
      {
        key: "order",
        label: currentOrder?.orderStatus || currentOrder?.status || "unknown",
      },
    ],
    [currentOrder]
  );

  const fulfillableItems = useMemo(() => {
    const fulfilledByItem = new Map();
    for (const item of lineItems) {
      fulfilledByItem.set(item.id, 0);
    }

    for (const fulfillment of fulfillments) {
      const status = String(fulfillment?.status || "").toUpperCase();
      if (["CANCELLED", "ERROR", "FAILURE"].includes(status)) continue;

      for (const item of fulfillment?.items || []) {
        fulfilledByItem.set(item.orderItemId, (fulfilledByItem.get(item.orderItemId) || 0) + Number(item.quantity || 0));
      }
    }

    return lineItems
      .map((item) => {
        const remaining = Number(item.quantity || 0) - (fulfilledByItem.get(item.id) || 0);
        return {
          id: item.id,
          title: item.title || "Item",
          variantTitle: item.variantTitle || item.variant || "",
          variantId: item.variantId || undefined,
          remainingQuantity: Math.max(0, remaining),
        };
      })
      .filter((item) => item.remainingQuantity > 0);
  }, [lineItems, fulfillments]);

  function normalizeItemsPayload() {
    const payload = [];

    for (const item of fulfillableItems) {
      const raw = selectedQuantities[item.id];
      if (raw == null || raw === "") continue;
      const quantity = Number.parseInt(String(raw), 10);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      if (quantity > item.remainingQuantity) {
        throw new Error(`Quantity for ${item.title} exceeds remaining fulfillable units.`);
      }

      payload.push({
        orderItemId: item.id,
        variantId: item.variantId,
        quantity,
      });
    }

    if (!payload.length) {
      throw new Error("Select at least one item quantity before creating fulfillment or buying a label.");
    }

    return payload;
  }

  function normalizeParcelPayload() {
    const parsed = {
      weightOz: Number(parcel.weightOz),
      lengthIn: Number(parcel.lengthIn),
      widthIn: Number(parcel.widthIn),
      heightIn: Number(parcel.heightIn),
    };

    const invalid = Object.values(parsed).some((value) => !Number.isFinite(value) || value <= 0);
    if (invalid) {
      throw new Error("Package dimensions must be valid positive numbers.");
    }

    return parsed;
  }

  async function refreshOrder() {
    if (!currentOrder?.orderNumber) return;
    setRefreshing(true);
    try {
      const response = await fetch(
        `/api/orders/${normalizeOrderNumber(currentOrder.orderNumber)}/detail`,
        { cache: "no-store" }
      );
      const json = await response.json();
      if (json?.success) {
        setLiveOrder(json.data);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function loadShippingRates() {
    if (!currentOrder?.orderNumberValue) return;

    setMessage("");
    setErrorMessage("");
    setRatesLoading(true);
    try {
      const items = normalizeItemsPayload();
      const parcelPayload = normalizeParcelPayload();
      const response = await fetch(`/api/orders/${normalizeOrderNumber(currentOrder.orderNumber)}/shipping-rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          parcel: parcelPayload,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(parseErrorMessage(json, "Failed to load shipping rates."));
      }

      const quotes = Array.isArray(json.data?.quotes) ? json.data.quotes : [];
      setRateQuotes(quotes);
      setRateProvider(json.data?.provider || "");
      setSelectedRateId(quotes[0]?.providerRateId || quotes[0]?.id || "");
      if (!quotes.length) {
        setMessage("No live label rates are available for the selected package.");
      }
    } catch (error) {
      setRateQuotes([]);
      setSelectedRateId("");
      setRateProvider("");
      setErrorMessage(error instanceof Error ? error.message : "Failed to load shipping rates.");
    } finally {
      setRatesLoading(false);
    }
  }

  async function buyShippingLabel() {
    if (!currentOrder?.orderNumberValue) return;
    setMessage("");
    setErrorMessage("");
    setBuyingLabel(true);
    try {
      const items = normalizeItemsPayload();
      const parcelPayload = normalizeParcelPayload();
      if (!selectedRateId) {
        throw new Error("Select a provider rate before buying a label.");
      }
      const response = await fetch(`/api/orders/${normalizeOrderNumber(currentOrder.orderNumber)}/shipping-labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerRateId: selectedRateId,
          items,
          parcel: parcelPayload,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(parseErrorMessage(json, "Failed to buy shipping label."));
      }
      const duplicate = Boolean(json.data?.duplicate);
      setMessage(duplicate ? "Existing shipping label reused (no duplicate fulfillment created)." : "Shipping label purchased.");
      await refreshOrder();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to buy shipping label.");
    } finally {
      setBuyingLabel(false);
    }
  }

  async function createManualTrackingFulfillment() {
    if (!currentOrder?.orderNumberValue) return;
    setMessage("");
    setErrorMessage("");
    setCreatingManual(true);
    try {
      const items = normalizeItemsPayload();
      const response = await fetch(`/api/orders/${normalizeOrderNumber(currentOrder.orderNumber)}/manual-fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          carrier: manualForm.carrier || undefined,
          service: manualForm.service || undefined,
          trackingNumber: manualForm.trackingNumber || undefined,
          trackingUrl: manualForm.trackingUrl || undefined,
          sendTrackingEmail: Boolean(manualForm.sendTrackingEmail),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(parseErrorMessage(json, "Failed to add manual tracking."));
      }
      setMessage(manualForm.sendTrackingEmail ? "Manual tracking saved and shipment email queued." : "Manual tracking saved.");
      setManualForm((previous) => ({
        ...previous,
        trackingNumber: "",
        trackingUrl: "",
      }));
      await refreshOrder();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add manual tracking.");
    } finally {
      setCreatingManual(false);
    }
  }

  async function updateOrderStatusPatch(patch, loadingKey, successMessage) {
    if (!currentOrder?.orderNumberValue) return;
    setMessage("");
    setErrorMessage("");
    setStatusActionLoading(loadingKey);
    try {
      const response = await fetch(`/api/orders/${normalizeOrderNumber(currentOrder.orderNumber)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(parseErrorMessage(json, "Failed to update order status."));
      }
      setMessage(successMessage);
      await refreshOrder();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update order status.");
    } finally {
      setStatusActionLoading("");
    }
  }

  async function saveInternalNote() {
    if (!currentOrder?.orderNumberValue) return;
    setSavingInternalNote(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch(`/api/orders/${normalizeOrderNumber(currentOrder.orderNumber)}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          internalNote: internalNoteDraft,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(parseErrorMessage(json, "Failed to save internal note."));
      }
      setMessage("Internal note updated.");
      await refreshOrder();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save internal note.");
    } finally {
      setSavingInternalNote(false);
    }
  }

  async function addCustomerVisibleNote() {
    if (!currentOrder?.orderNumberValue) return;
    setSavingCustomerNote(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await fetch(`/api/orders/${normalizeOrderNumber(currentOrder.orderNumber)}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerNote: customerNoteDraft,
          sendCustomerEmail: sendCustomerNoteEmail,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(parseErrorMessage(json, "Failed to add customer-visible note."));
      }
      const sent = Boolean(json.data?.emailDelivery?.sent);
      const attempted = Boolean(json.data?.emailDelivery?.attempted);
      const failed = attempted && !sent;
      setMessage(
        failed
          ? "Customer-visible note saved, but email delivery failed."
          : sent
            ? "Customer-visible note saved and emailed."
            : "Customer-visible note saved."
      );
      setCustomerNoteDraft("");
      setSendCustomerNoteEmail(false);
      await refreshOrder();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add customer-visible note.");
    } finally {
      setSavingCustomerNote(false);
    }
  }

  if (!currentOrder) {
    return (
      <div className={styles.page}>
        <div className={styles.breadcrumbs}>
          <Link className={styles.inlineLinkButton} href="/orders">
            Back to orders
          </Link>
        </div>
        <AdminEmptyState
          description="This order may have been removed or the identifier may be invalid."
          title="Order not found"
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Link className={styles.inlineLinkButton} href="/orders">
          Back to orders
        </Link>
      </div>

      <AdminCard className={styles.headerCard} variant="panel">
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>{currentOrder.orderNumber}</h1>
            <p className={styles.meta}>
              Created {new Date(currentOrder.createdAt).toLocaleString()} via {currentOrder.sourceChannel || currentOrder.channel || "unknown source"}
            </p>
          </div>
          <div className={styles.headerActions}>
            <AdminButton loading={refreshing} onClick={refreshOrder} size="sm" variant="secondary">
              Refresh
            </AdminButton>
            <AdminButton onClick={() => window.print()} size="sm" variant="ghost">
              Print
            </AdminButton>
          </div>
        </div>
        <div className={styles.chipsRow}>
          {chips.map((chip) => (
            <AdminStatusChip key={chip.key} tone={orderStatusChipTone(chip.label)}>
              {chip.label}
            </AdminStatusChip>
          ))}
        </div>
        <div className={styles.actionRow}>
          {currentOrder?.availableActions?.canMarkPaid ? (
            <AdminButton
              loading={statusActionLoading === "markPaid"}
              onClick={() =>
                updateOrderStatusPatch(
                  { paymentStatus: "PAID" },
                  "markPaid",
                  "Payment status updated to PAID."
                )
              }
              size="sm"
              variant="secondary"
            >
              Mark paid
            </AdminButton>
          ) : null}
          {currentOrder?.availableActions?.canMarkPaymentPending ? (
            <AdminButton
              loading={statusActionLoading === "markPending"}
              onClick={() =>
                updateOrderStatusPatch(
                  { paymentStatus: "PENDING" },
                  "markPending",
                  "Payment status updated to PENDING."
                )
              }
              size="sm"
              variant="secondary"
            >
              Mark payment pending
            </AdminButton>
          ) : null}
          {currentOrder?.availableActions?.canMarkFulfilled ? (
            <AdminButton
              loading={statusActionLoading === "markFulfilled"}
              onClick={() =>
                updateOrderStatusPatch(
                  { fulfillmentStatus: "FULFILLED" },
                  "markFulfilled",
                  "Fulfillment status updated to FULFILLED."
                )
              }
              size="sm"
              variant="secondary"
            >
              Mark fulfilled
            </AdminButton>
          ) : null}
          {currentOrder?.availableActions?.canMarkUnfulfilled ? (
            <AdminButton
              loading={statusActionLoading === "markUnfulfilled"}
              onClick={() =>
                updateOrderStatusPatch(
                  { fulfillmentStatus: "UNFULFILLED" },
                  "markUnfulfilled",
                  "Fulfillment status updated to UNFULFILLED."
                )
              }
              size="sm"
              variant="secondary"
            >
              Mark unfulfilled
            </AdminButton>
          ) : null}
        </div>
      </AdminCard>

      <div className={styles.grid}>
        <div className={styles.mainColumn}>
          <AdminCard variant="panel">
            <div className={styles.cardHeader}>
              <h3>Fulfillment</h3>
            </div>

            {message ? <p className={styles.successText}>{message}</p> : null}
            {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

            {fulfillments.length ? (
              <div className={styles.fulfillmentList}>
                {fulfillments.map((entry) => (
                  <div className={styles.fulfillmentRow} key={entry.id}>
                    <div>
                      <strong>{entry.carrier || "Carrier pending"}</strong>
                      <p>
                        {entry.service || "Service pending"}
                        {entry.trackingNumber ? ` | ${entry.trackingNumber}` : ""}
                      </p>
                      {entry.trackingUrl ? (
                        <a className={styles.inlineLinkButton} href={entry.trackingUrl} rel="noreferrer" target="_blank">
                          Track shipment
                        </a>
                      ) : null}
                      {entry.labelUrl ? (
                        <a className={styles.inlineLinkButton} href={entry.labelUrl} rel="noreferrer" target="_blank">
                          Reprint label
                        </a>
                      ) : null}
                    </div>
                    <AdminStatusChip tone={orderStatusChipTone(entry.status)}>
                      {entry.status}
                    </AdminStatusChip>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState
                description="No fulfillments have been created for this order yet."
                icon="local_shipping"
                title="No fulfillment records"
              />
            )}

            <div className={styles.divider} />
            <div className={styles.cardHeader}>
              <h3>Fulfillment operations</h3>
            </div>
            {fulfillableItems.length ? (
              <div className={styles.selectorList}>
                {fulfillableItems.map((item) => (
                  <label className={styles.selectorRow} key={item.id}>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.variantTitle || "Default variant"} | Remaining {item.remainingQuantity}</small>
                    </span>
                    <input
                      className={styles.quantityInput}
                      max={item.remainingQuantity}
                      min={0}
                      onChange={(event) =>
                        setSelectedQuantities((previous) => ({
                          ...previous,
                          [item.id]: event.target.value,
                        }))
                      }
                      placeholder="0"
                      type="number"
                      value={selectedQuantities[item.id] ?? ""}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <p className={styles.metaText}>All line items are already fulfilled.</p>
            )}

            {labelProviderConnected ? (
              <>
                <div className={styles.formGrid}>
                  <AdminField hint="Required for label rates and purchase." label="Weight (oz)">
                    <AdminInput
                      min="0"
                      onChange={(event) => setParcel((previous) => ({ ...previous, weightOz: event.target.value }))}
                      step="0.01"
                      type="number"
                      value={parcel.weightOz}
                    />
                  </AdminField>
                  <AdminField label="Length (in)">
                    <AdminInput
                      min="0"
                      onChange={(event) => setParcel((previous) => ({ ...previous, lengthIn: event.target.value }))}
                      step="0.01"
                      type="number"
                      value={parcel.lengthIn}
                    />
                  </AdminField>
                  <AdminField label="Width (in)">
                    <AdminInput
                      min="0"
                      onChange={(event) => setParcel((previous) => ({ ...previous, widthIn: event.target.value }))}
                      step="0.01"
                      type="number"
                      value={parcel.widthIn}
                    />
                  </AdminField>
                  <AdminField label="Height (in)">
                    <AdminInput
                      min="0"
                      onChange={(event) => setParcel((previous) => ({ ...previous, heightIn: event.target.value }))}
                      step="0.01"
                      type="number"
                      value={parcel.heightIn}
                    />
                  </AdminField>
                </div>

                <div className={styles.actionRow}>
                  <AdminButton loading={ratesLoading} onClick={loadShippingRates} size="sm" variant="secondary">
                    Load shipping rates
                  </AdminButton>
                </div>

                {rateQuotes.length ? (
                  <div className={styles.rateList}>
                    {rateQuotes.map((quote) => {
                      const rateId = quote.providerRateId || quote.id;
                      return (
                        <label className={styles.rateRow} key={rateId}>
                          <input
                            checked={selectedRateId === rateId}
                            name="shipping-rate"
                            onChange={() => setSelectedRateId(rateId)}
                            type="radio"
                          />
                          <span>
                            <strong>{quote.displayName || quote.service || "Carrier rate"}</strong>
                            <small>
                              {(quote.carrier ? `${quote.carrier} | ` : "") +
                                formatMoney((quote.amountCents || 0) / 100, quote.currency || currency)}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                    <div className={styles.actionRow}>
                      <AdminButton disabled={!canBuyShippingLabel} loading={buyingLabel} onClick={buyShippingLabel} size="sm">
                        Buy shipping label{rateProvider ? ` (${rateProvider})` : ""}
                      </AdminButton>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className={styles.metaText}>
                No label provider is connected. Use manual fulfillment below to mark shipped and add tracking.
              </p>
            )}

            {shippingLabels.length ? (
              <>
                <div className={styles.divider} />
                <div className={styles.cardHeader}>
                  <h3>Shipping labels</h3>
                </div>
                <div className={styles.labelList}>
                  {shippingLabels.map((label) => (
                    <div className={styles.labelRow} key={label.id}>
                      <div>
                        <strong>{label.carrier || label.provider || "Carrier"}</strong>
                        <p>{label.trackingNumber || "Tracking pending"}</p>
                      </div>
                      {label.labelUrl ? (
                        <a className={styles.inlineLinkButton} href={label.labelUrl} rel="noreferrer" target="_blank">
                          Print / reprint
                        </a>
                      ) : (
                        <span className={styles.metaText}>Label URL unavailable</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <div className={styles.divider} />
            <div className={styles.cardHeader}>
              <h3>Mark fulfilled / add tracking manually</h3>
            </div>
            <div className={styles.formGrid}>
              <AdminField label="Carrier">
                <AdminInput
                  onChange={(event) => setManualForm((previous) => ({ ...previous, carrier: event.target.value }))}
                  placeholder="UPS"
                  value={manualForm.carrier}
                />
              </AdminField>
              <AdminField label="Service">
                <AdminInput
                  onChange={(event) => setManualForm((previous) => ({ ...previous, service: event.target.value }))}
                  placeholder="Ground"
                  value={manualForm.service}
                />
              </AdminField>
              <AdminField label="Tracking number">
                <AdminInput
                  onChange={(event) => setManualForm((previous) => ({ ...previous, trackingNumber: event.target.value }))}
                  placeholder="1Z..."
                  value={manualForm.trackingNumber}
                />
              </AdminField>
              <AdminField label="Tracking URL">
                <AdminInput
                  onChange={(event) => setManualForm((previous) => ({ ...previous, trackingUrl: event.target.value }))}
                  placeholder="https://tracking.example.com/..."
                  value={manualForm.trackingUrl}
                />
              </AdminField>
            </div>
            <label className={styles.checkboxRow}>
              <input
                checked={manualForm.sendTrackingEmail}
                onChange={(event) =>
                  setManualForm((previous) => ({
                    ...previous,
                    sendTrackingEmail: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>Send shipment tracking email to customer</span>
            </label>
            <div className={styles.actionRow}>
              <AdminButton loading={creatingManual} onClick={createManualTrackingFulfillment} size="sm">
                Save manual tracking
              </AdminButton>
            </div>
          </AdminCard>

          <AdminCard variant="panel">
            <div className={styles.cardHeader}>
              <h3>Line items</h3>
            </div>
            {lineItems.length ? (
              <div className={styles.lineItemList}>
                {lineItems.map((item) => (
                  <div className={styles.lineItemRow} key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.variantTitle || item.variant || "Default variant"}</p>
                      {(Number(item.totalDiscountCents || 0) > 0 || Number(item.totalDiscount || 0) > 0) ? (
                        <p>
                          Discount allocation:{" "}
                          {formatMoney(
                            item.totalDiscount ?? (Number(item.totalDiscountCents || 0) / 100),
                            currency
                          )}
                        </p>
                      ) : null}
                    </div>
                    <div className={styles.lineItemMeta}>
                      <span>x{item.quantity}</span>
                      <strong>{formatMoney(item.total ?? Number(item.price || 0) * Number(item.quantity || 0), currency)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState
                description="No line items were found for this order."
                icon="inventory_2"
                title="No line items"
              />
            )}
          </AdminCard>

          <AdminCard variant="panel">
            <div className={styles.cardHeader}>
              <h3>Payment summary</h3>
            </div>
            <div className={styles.summaryRows}>
              <SummaryRow label="Subtotal" value={formatMoney(currentOrder.subtotal, currency)} />
              <SummaryRow label="Shipping" value={formatMoney(currentOrder.shippingAmount, currency)} />
              {currentOrder.shippingMethodName ? (
                <SummaryRow label="Shipping method" value={currentOrder.shippingMethodName} />
              ) : null}
              <SummaryRow label="Tax" value={formatMoney(currentOrder.taxAmount, currency)} />
              <SummaryRow label="Discount" value={formatMoney(currentOrder.discountAmount || 0, currency)} />
              <SummaryRow label="Total" strong value={formatMoney(currentOrder.total, currency)} />
            </div>
          </AdminCard>

          <AdminCard variant="panel">
            <div className={styles.cardHeader}>
              <h3>Discounts</h3>
            </div>
            {discounts.length ? (
              <div className={styles.discountList}>
                {discounts.map((discount) => (
                  <div className={styles.discountRow} key={discount.id}>
                    <div>
                      <strong>{discount.title || "Discount"}</strong>
                      <p>
                        {discount.code ? `Code: ${discount.code}` : "Manual discount"}
                        {discount.method ? ` | ${String(discount.method).replaceAll("_", " ").toLowerCase()}` : ""}
                      </p>
                    </div>
                    <strong>
                      -{formatMoney(
                        discount.amount ?? (Number(discount.amountCents || 0) / 100),
                        currency
                      )}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState
                description="No discount applications were recorded for this order."
                icon="sell"
                title="No discounts"
              />
            )}
          </AdminCard>

          <OrderAdjustmentsCard
            onOrderRefresh={refreshOrder}
            orderId={currentOrder.id}
            orderNumber={currentOrder.orderNumber}
            paymentStatus={currentOrder.paymentStatusRaw || currentOrder.paymentStatus}
          />

          <AdminCard variant="panel">
            <div className={styles.cardHeader}>
              <h3>Timeline</h3>
            </div>
            {timeline.length ? (
              <div className={styles.timelineList}>
                {timeline.map((entry) => (
                  <div className={styles.timelineRow} key={entry.id}>
                    <strong>{entry.event || entry.title || entry.type}</strong>
                    <p>{entry.detail || "No detail provided."}</p>
                    <small>{new Date(entry.createdAt).toLocaleString()}</small>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState
                description="No timeline events have been recorded yet."
                icon="schedule"
                title="No timeline events"
              />
            )}
          </AdminCard>
        </div>

        <div className={styles.sideColumn}>
          <AdminCard variant="panel">
            <div className={styles.cardHeader}>
              <h3>Notes</h3>
            </div>
            <div className={styles.noteStack}>
              <AdminField label="Internal note">
                <AdminTextarea
                  onChange={(event) => setInternalNoteDraft(event.target.value)}
                  placeholder="Internal order note"
                  rows={3}
                  value={internalNoteDraft}
                />
              </AdminField>
              <div className={styles.actionRow}>
                <AdminButton loading={savingInternalNote} onClick={saveInternalNote} size="sm" variant="secondary">
                  Save internal note
                </AdminButton>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.noteStack}>
              <AdminField hint="Optional customer-facing update." label="Customer-visible note">
                <AdminTextarea
                  onChange={(event) => setCustomerNoteDraft(event.target.value)}
                  placeholder="Share a shipping or order update with the customer"
                  rows={3}
                  value={customerNoteDraft}
                />
              </AdminField>
              <label className={styles.checkboxRow}>
                <input
                  checked={sendCustomerNoteEmail}
                  onChange={(event) => setSendCustomerNoteEmail(event.target.checked)}
                  type="checkbox"
                />
                <span>Send this note to the customer by email</span>
              </label>
              <div className={styles.actionRow}>
                <AdminButton loading={savingCustomerNote} onClick={addCustomerVisibleNote} size="sm">
                  Add customer note
                </AdminButton>
              </div>
            </div>

            <div className={styles.divider} />
            <div className={styles.cardHeader}>
              <h3>Customer-visible note history</h3>
            </div>
            {customerVisibleNotes.length ? (
              <div className={styles.timelineList}>
                {customerVisibleNotes.map((entry) => (
                  <div className={styles.timelineRow} key={entry.id}>
                    <strong>{entry.note}</strong>
                    <small>{new Date(entry.createdAt).toLocaleString()}</small>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState
                description="No customer-visible notes were added yet."
                icon="note_stack"
                title="No notes"
              />
            )}
          </AdminCard>

          <AdminCard variant="panel">
            <div className={styles.cardHeader}>
              <h3>Customer</h3>
            </div>
            <div className={styles.infoBlock}>
              <p>{currentOrder.customer?.name || "Guest customer"}</p>
              <p>{currentOrder.customer?.email || currentOrder.email || "No email"}</p>
              <p>{currentOrder.customer?.phone || "No phone"}</p>
            </div>
          </AdminCard>

          <AdminCard variant="panel">
            <div className={styles.cardHeader}>
              <h3>Shipping address</h3>
            </div>
            <p className={styles.noteText}>{formatAddress(shippingAddress)}</p>
          </AdminCard>

          <AdminCard variant="panel">
            <div className={styles.cardHeader}>
              <h3>Billing address</h3>
            </div>
            <p className={styles.noteText}>{formatAddress(billingAddress)}</p>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
