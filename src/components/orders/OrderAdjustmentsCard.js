"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminButton from "../admin/ui/AdminButton";
import AdminCard from "../admin/ui/AdminCard";
import AdminDrawer from "../admin/ui/AdminDrawer";
import AdminEmptyState from "../admin/ui/AdminEmptyState";
import AdminFormSection from "../admin/ui/AdminFormSection";
import AdminInput from "../admin/ui/AdminInput";
import AdminSelect from "../admin/ui/AdminSelect";
import AdminSkeleton from "../admin/ui/AdminSkeleton";
import AdminStatCard, { AdminStatsGrid } from "../admin/ui/AdminStatCard";
import AdminStatusChip from "../admin/ui/AdminStatusChip";
import AdminTable from "../admin/ui/AdminTable";
import AdminTextarea from "../admin/ui/AdminTextarea";
import AdminTooltip from "../admin/ui/AdminTooltip";
import styles from "./OrderAdjustmentsCard.module.css";

const REFUND_REASON_OPTIONS = [
  { value: "customer_request", label: "Customer request", providerReason: "requested_by_customer" },
  { value: "damaged_item", label: "Damaged item", providerReason: "requested_by_customer" },
  { value: "wrong_item", label: "Wrong item", providerReason: "requested_by_customer" },
  { value: "shipping_issue", label: "Shipping issue", providerReason: "requested_by_customer" },
  { value: "inventory_issue", label: "Inventory issue", providerReason: "requested_by_customer" },
  { value: "fraudulent_order", label: "Fraudulent order", providerReason: "fraudulent" },
  { value: "other", label: "Other", providerReason: "requested_by_customer" },
];

const RETURN_REASON_OPTIONS = REFUND_REASON_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

const RETURN_ACTIONS_BY_STATUS = {
  REQUESTED: [
    { status: "APPROVED", label: "Approve" },
    { status: "DECLINED", label: "Decline" },
  ],
  APPROVED: [{ status: "IN_TRANSIT", label: "Mark in transit" }],
  IN_TRANSIT: [{ status: "RECEIVED", label: "Mark received" }],
  RECEIVED: [{ status: "CLOSED", label: "Close" }],
  CLOSED: [],
  DECLINED: [],
};

function normalizeOrderNumber(value) {
  return String(value || "").replace(/^#/, "");
}

function formatCents(cents, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format((Number(cents || 0) || 0) / 100);
}

function toDollarsInput(cents) {
  const normalized = Math.max(0, Number(cents || 0));
  return (normalized / 100).toFixed(2);
}

function parseDollarsToCents(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function statusTone(status) {
  const normalized = String(status || "").toUpperCase();
  if (["ISSUED", "CLOSED", "APPROVED", "RECEIVED", "REFUNDED"].includes(normalized)) return "success";
  if (["FAILED", "DECLINED"].includes(normalized)) return "danger";
  if (["PENDING", "REQUESTED", "IN_TRANSIT", "PARTIALLY_REFUNDED"].includes(normalized)) return "warning";
  return "neutral";
}

function buildReasonNote(label, note) {
  const trimmed = String(note || "").trim();
  if (!trimmed) {
    return label === "Customer request" ? undefined : `Reason category: ${label}`;
  }
  if (label === "Customer request") {
    return trimmed;
  }
  return `Reason category: ${label}\n${trimmed}`;
}

function itemUnitPriceCents(item) {
  const quantity = Number(item.purchasedQuantity || 0);
  if (quantity <= 0) return Number(item.totalCents || 0);
  return Math.max(0, Math.round(Number(item.totalCents || 0) / quantity));
}

function buildRefundDraftItems(orderItems) {
  return (orderItems || []).map((item) => {
    const unitCents = itemUnitPriceCents(item);
    return {
      orderItemId: item.orderItemId,
      selected: false,
      quantity: item.remainingEligibleQuantity > 0 ? 1 : 0,
      amountDollars: toDollarsInput(unitCents),
    };
  });
}

function buildReturnDraftItems(orderItems) {
  return (orderItems || []).map((item) => ({
    orderItemId: item.orderItemId,
    selected: false,
    quantity: item.remainingEligibleQuantity > 0 ? 1 : 0,
  }));
}

export default function OrderAdjustmentsCard({ onOrderRefresh, orderNumber, paymentStatus = "" }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState({ tone: "", message: "" });
  const [activeDrawer, setActiveDrawer] = useState("");
  const [pendingReturnAction, setPendingReturnAction] = useState("");

  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("customer_request");
  const [refundNote, setRefundNote] = useState("");
  const [refundRestock, setRefundRestock] = useState(false);
  const [refundConfirm, setRefundConfirm] = useState(false);
  const [refundItems, setRefundItems] = useState([]);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState("");

  const [returnReason, setReturnReason] = useState("customer_request");
  const [returnNote, setReturnNote] = useState("");
  const [returnItems, setReturnItems] = useState([]);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState("");

  const normalizedOrderNumber = useMemo(() => normalizeOrderNumber(orderNumber), [orderNumber]);
  const orderItems = summary?.orderItems || [];
  const refunds = summary?.refunds || [];
  const returns = summary?.returns || [];
  const currency = summary?.currency || "USD";

  const orderItemById = useMemo(
    () => new Map(orderItems.map((item) => [item.orderItemId, item])),
    [orderItems]
  );

  const refundsById = useMemo(
    () => new Map(refunds.map((refund) => [refund.id, refund])),
    [refunds]
  );

  const refreshSummary = useCallback(async () => {
    if (!normalizedOrderNumber) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${normalizedOrderNumber}/adjustments`, { cache: "no-store" });
      const json = await response.json();
      if (!json?.success) {
        throw new Error(json?.error || "Failed to load order adjustments");
      }
      setSummary(json.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load order adjustments");
    } finally {
      setLoading(false);
    }
  }, [normalizedOrderNumber]);

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  const historyRows = useMemo(() => {
    const returnRows = returns.map((entry) => {
      const linkedRefund = entry.refundId ? refundsById.get(entry.refundId) : null;
      return {
        id: `return:${entry.id}`,
        entityId: entry.id,
        type: "Return",
        status: entry.status,
        amountCents: linkedRefund?.amountCents ?? null,
        reason: entry.reason || entry.note || "—",
        createdAt: entry.createdAt,
      };
    });

    const refundRows = refunds.map((entry) => ({
      id: `refund:${entry.id}`,
      entityId: entry.id,
      type: "Refund",
      status: entry.status,
      amountCents: entry.amountCents,
      reason: entry.reason || entry.note || "—",
      createdAt: entry.createdAt,
    }));

    return [...returnRows, ...refundRows].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }, [refunds, refundsById, returns]);

  const historyColumns = useMemo(
    () => [
      { key: "type", header: "Type", render: (row) => row.type },
      {
        key: "status",
        header: "Status",
        render: (row) => <AdminStatusChip tone={statusTone(row.status)}>{row.status}</AdminStatusChip>,
      },
      {
        key: "amount",
        header: "Amount",
        render: (row) => (row.amountCents == null ? "—" : formatCents(row.amountCents, currency)),
      },
      { key: "reason", header: "Reason", render: (row) => row.reason },
      {
        key: "date",
        header: "Date",
        render: (row) => new Date(row.createdAt).toLocaleString(),
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => {
          if (row.type !== "Return") return "—";
          const actions = RETURN_ACTIONS_BY_STATUS[row.status] || [];
          if (!actions.length) return "—";
          return (
            <div className={styles.inlineActions}>
              {actions.map((action) => (
                <AdminButton
                  key={`${row.entityId}-${action.status}`}
                  loading={pendingReturnAction === `${row.entityId}:${action.status}`}
                  onClick={() => updateReturnStatus(row.entityId, action.status)}
                  size="sm"
                  variant="secondary"
                >
                  {action.label}
                </AdminButton>
              ))}
            </div>
          );
        },
      },
    ],
    [currency, pendingReturnAction]
  );

  async function onMutationSuccess(message) {
    setNotice({ tone: "success", message });
    await Promise.all([refreshSummary(), onOrderRefresh?.()]);
  }

  async function updateReturnStatus(returnId, status) {
    setPendingReturnAction(`${returnId}:${status}`);
    setNotice({ tone: "", message: "" });
    try {
      const response = await fetch(`/api/orders/${normalizedOrderNumber}/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await response.json();
      if (!json?.success) {
        throw new Error(json?.error || "Failed to update return status");
      }
      await onMutationSuccess(`Return updated to ${status.replaceAll("_", " ").toLowerCase()}.`);
    } catch (actionError) {
      setNotice({
        tone: "danger",
        message: actionError instanceof Error ? actionError.message : "Failed to update return status",
      });
    } finally {
      setPendingReturnAction("");
    }
  }

  function openRefundDrawer() {
    setRefundAmount(toDollarsInput(summary?.remainingRefundableAmountCents || 0));
    setRefundReason("customer_request");
    setRefundNote("");
    setRefundRestock(false);
    setRefundConfirm(false);
    setRefundItems(buildRefundDraftItems(orderItems));
    setRefundError("");
    setActiveDrawer("refund");
  }

  function openReturnDrawer() {
    setReturnReason("customer_request");
    setReturnNote("");
    setReturnItems(buildReturnDraftItems(orderItems));
    setReturnError("");
    setActiveDrawer("return");
  }

  function patchRefundDraft(orderItemId, patch) {
    setRefundItems((current) =>
      current.map((entry) => (entry.orderItemId === orderItemId ? { ...entry, ...patch } : entry))
    );
  }

  function patchReturnDraft(orderItemId, patch) {
    setReturnItems((current) =>
      current.map((entry) => (entry.orderItemId === orderItemId ? { ...entry, ...patch } : entry))
    );
  }

  const selectedRefundItems = useMemo(
    () => refundItems.filter((item) => item.selected),
    [refundItems]
  );

  const restockEligible = useMemo(
    () =>
      selectedRefundItems.length > 0 &&
      selectedRefundItems.every((item) => Boolean(orderItemById.get(item.orderItemId)?.variantId)),
    [orderItemById, selectedRefundItems]
  );

  async function submitRefundRecord() {
    const selectedReason = REFUND_REASON_OPTIONS.find((option) => option.value === refundReason);
    if (!selectedReason) {
      setRefundError("Select a refund reason.");
      return;
    }

    const amountCents = parseDollarsToCents(refundAmount);
    if (!amountCents) {
      setRefundError("Enter a valid refund amount.");
      return;
    }

    if (amountCents > Number(summary?.remainingRefundableAmountCents || 0)) {
      setRefundError("Refund amount exceeds remaining refundable amount.");
      return;
    }

    if (!refundConfirm) {
      setRefundError("Confirm provider refund awareness before submitting.");
      return;
    }

    const payloadItems = [];
    for (const selectedItem of selectedRefundItems) {
      const source = orderItemById.get(selectedItem.orderItemId);
      if (!source) continue;

      const quantity = parseInt(String(selectedItem.quantity || 0), 10);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        setRefundError("Selected refund item quantities must be positive integers.");
        return;
      }
      if (quantity > Number(source.remainingEligibleQuantity || 0)) {
        setRefundError("A selected refund quantity exceeds remaining eligible quantity.");
        return;
      }

      const amountForItemCents = parseDollarsToCents(selectedItem.amountDollars);
      if (!amountForItemCents) {
        setRefundError("Selected refund item amounts must be valid positive dollar values.");
        return;
      }

      payloadItems.push({
        orderItemId: selectedItem.orderItemId,
        variantId: source.variantId || undefined,
        quantity,
        amountCents: amountForItemCents,
      });
    }

    const selectedItemAmountTotal = payloadItems.reduce((sum, item) => sum + item.amountCents, 0);
    if (selectedItemAmountTotal > amountCents) {
      setRefundError("Selected item refund amounts cannot exceed total refund amount.");
      return;
    }

    if (refundRestock && !restockEligible) {
      setRefundError("Restock is only available when all selected items have variant IDs.");
      return;
    }

    setRefundSubmitting(true);
    setRefundError("");
    setNotice({ tone: "", message: "" });

    try {
      const response = await fetch(`/api/orders/${normalizedOrderNumber}/refund-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          reason: selectedReason.providerReason,
          note: buildReasonNote(selectedReason.label, refundNote),
          restockItems: refundRestock ? true : undefined,
          items: payloadItems.length ? payloadItems : undefined,
        }),
      });

      const json = await response.json();
      if (!json?.success) {
        throw new Error(json?.error || "Failed to create refund record");
      }

      setActiveDrawer("");
      await onMutationSuccess("Refund record created.");
    } catch (submitError) {
      setRefundError(submitError instanceof Error ? submitError.message : "Failed to create refund record");
    } finally {
      setRefundSubmitting(false);
    }
  }

  async function submitReturnRecord() {
    const selectedReason = RETURN_REASON_OPTIONS.find((option) => option.value === returnReason);
    if (!selectedReason) {
      setReturnError("Select a return reason.");
      return;
    }

    const selectedItems = returnItems.filter((item) => item.selected);
    if (!selectedItems.length) {
      setReturnError("Select at least one item to include in the return.");
      return;
    }

    const payloadItems = [];
    for (const selectedItem of selectedItems) {
      const source = orderItemById.get(selectedItem.orderItemId);
      if (!source) continue;

      const quantity = parseInt(String(selectedItem.quantity || 0), 10);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        setReturnError("Selected return quantities must be positive integers.");
        return;
      }
      if (quantity > Number(source.remainingEligibleQuantity || 0)) {
        setReturnError("A selected return quantity exceeds remaining eligible quantity.");
        return;
      }

      payloadItems.push({
        orderItemId: selectedItem.orderItemId,
        variantId: source.variantId || undefined,
        quantity,
        reason: selectedReason.label,
      });
    }

    setReturnSubmitting(true);
    setReturnError("");
    setNotice({ tone: "", message: "" });

    try {
      const response = await fetch(`/api/orders/${normalizedOrderNumber}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: selectedReason.label,
          note: returnNote || undefined,
          items: payloadItems,
        }),
      });
      const json = await response.json();
      if (!json?.success) {
        throw new Error(json?.error || "Failed to create return record");
      }

      setActiveDrawer("");
      await onMutationSuccess("Return record created.");
    } catch (submitError) {
      setReturnError(submitError instanceof Error ? submitError.message : "Failed to create return record");
    } finally {
      setReturnSubmitting(false);
    }
  }

  return (
    <AdminCard className={styles.adjustmentsCard} variant="panel">
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.title}>Returns & refunds</h3>
          <p className={styles.subtitle}>Return records track item workflows. Refund records track payment adjustments.</p>
        </div>
        <div className={styles.headerActions}>
          <AdminButton onClick={openReturnDrawer} size="sm" variant="secondary">
            Start return
          </AdminButton>
          <AdminButton onClick={openRefundDrawer} size="sm" variant="primary">
            Create refund record
          </AdminButton>
          <AdminButton onClick={refreshSummary} size="sm" variant="ghost">
            Refresh
          </AdminButton>
        </div>
      </div>

      {notice.message ? (
        <div className={styles.noticeRow}>
          <AdminStatusChip tone={notice.tone || "neutral"}>{notice.message}</AdminStatusChip>
        </div>
      ) : null}

      {loading ? (
        <div className={styles.loadingState}>
          <AdminSkeleton variant="card" />
          <AdminSkeleton variant="table" rows={4} />
        </div>
      ) : null}

      {!loading && error ? (
        <AdminEmptyState
          actionLabel="Retry"
          description={error}
          icon="warning"
          onAction={refreshSummary}
          title="Unable to load adjustments"
        />
      ) : null}

      {!loading && !error && summary ? (
        <>
          <AdminStatsGrid>
            <AdminStatCard label="Paid amount" value={formatCents(summary.paidAmountCents, currency)} />
            <AdminStatCard label="Already refunded" value={formatCents(summary.recordedRefundAmountCents, currency)} />
            <AdminStatCard label="Remaining refundable" value={formatCents(summary.remainingRefundableAmountCents, currency)} />
            <AdminStatCard
              label="Payment status"
              value={String(paymentStatus || summary.paymentStatus || "UNKNOWN").replaceAll("_", " ")}
              meta={`${returns.length} return record(s), ${refunds.length} refund record(s)`}
            />
          </AdminStatsGrid>

          {historyRows.length ? (
            <AdminTable columns={historyColumns} rows={historyRows} />
          ) : (
            <AdminEmptyState
              description="Create a return or refund record from this order."
              title="No returns or refunds yet"
            />
          )}
        </>
      ) : null}

      <AdminDrawer
        actions={
          <>
            <AdminButton onClick={() => setActiveDrawer("")} size="sm" variant="ghost">
              Cancel
            </AdminButton>
            <AdminButton loading={refundSubmitting} onClick={submitRefundRecord} size="sm" variant="primary">
              Create refund record
            </AdminButton>
          </>
        }
        contextItems={[`Orders`, `#${normalizedOrderNumber}`, "Refund"]}
        onClose={() => setActiveDrawer("")}
        open={activeDrawer === "refund"}
        subtitle="Refund availability is calculated server-side."
        title="Create refund record"
      >
        <div className={styles.drawerStack}>
          <p className={styles.drawerHint}>Provider refund status will be recorded after the server operation completes.</p>
          {refundError ? <p className={styles.errorText}>{refundError}</p> : null}

          <AdminFormSection description="Use integer cents at submission time. The server enforces final refund limits." title="Refund details">
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Refund amount (USD)</span>
                <AdminInput
                  min="0.01"
                  onChange={(event) => setRefundAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={refundAmount}
                />
                <small>Max: {formatCents(summary?.remainingRefundableAmountCents || 0, currency)}</small>
              </label>
              <label className={styles.field}>
                <span>Reason</span>
                <AdminSelect
                  onChange={setRefundReason}
                  options={REFUND_REASON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  value={refundReason}
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Internal note</span>
              <AdminTextarea
                onChange={(event) => setRefundNote(event.target.value)}
                placeholder="Optional context for this refund record."
                rows={3}
                value={refundNote}
              />
            </label>
          </AdminFormSection>

          <AdminFormSection description="Optional item breakdown. Leave unselected for order-level refund records." title="Item selector">
            <div className={styles.selectorList}>
              {refundItems.map((draft) => {
                const source = orderItemById.get(draft.orderItemId);
                if (!source) return null;
                return (
                  <div className={styles.selectorRow} key={draft.orderItemId}>
                    <label className={styles.selectorCheckbox}>
                      <input
                        checked={draft.selected}
                        disabled={Number(source.remainingEligibleQuantity || 0) <= 0}
                        onChange={(event) => patchRefundDraft(draft.orderItemId, { selected: event.target.checked })}
                        type="checkbox"
                      />
                      <span>
                        {source.title} {source.variantId ? <small>({source.variantId})</small> : null}
                      </span>
                    </label>
                    <div className={styles.selectorMeta}>
                      <span>Purchased: {source.purchasedQuantity}</span>
                      <span>Refunded: {source.refundedQuantity}</span>
                      <span>Returned: {source.returnedQuantity}</span>
                      <span>Remaining: {source.remainingEligibleQuantity}</span>
                    </div>
                    <div className={styles.selectorInputs}>
                      <label>
                        Qty
                        <AdminInput
                          disabled={!draft.selected}
                          max={source.remainingEligibleQuantity}
                          min="1"
                          onChange={(event) => patchRefundDraft(draft.orderItemId, { quantity: event.target.value })}
                          type="number"
                          value={draft.quantity}
                        />
                      </label>
                      <label>
                        Item amount (USD)
                        <AdminInput
                          disabled={!draft.selected}
                          min="0.01"
                          onChange={(event) => patchRefundDraft(draft.orderItemId, { amountDollars: event.target.value })}
                          step="0.01"
                          type="number"
                          value={draft.amountDollars}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminFormSection>

          <AdminFormSection description="Restock is available only when all selected refund items have variant IDs." title="Safety checks">
            <div className={styles.checkboxRow}>
              <label className={styles.checkboxField}>
                <input
                  checked={refundRestock}
                  disabled={!restockEligible}
                  onChange={(event) => setRefundRestock(event.target.checked)}
                  type="checkbox"
                />
                <span>Restock selected items after provider refund success</span>
              </label>
              {!restockEligible ? (
                <AdminTooltip
                  content="Select at least one item with a variant ID to enable restocking safely."
                  label="Restock eligibility"
                />
              ) : null}
            </div>
            <label className={styles.checkboxField}>
              <input
                checked={refundConfirm}
                onChange={(event) => setRefundConfirm(event.target.checked)}
                type="checkbox"
              />
              <span>I understand this may create a payment-provider refund.</span>
            </label>
          </AdminFormSection>
        </div>
      </AdminDrawer>

      <AdminDrawer
        actions={
          <>
            <AdminButton onClick={() => setActiveDrawer("")} size="sm" variant="ghost">
              Cancel
            </AdminButton>
            <AdminButton loading={returnSubmitting} onClick={submitReturnRecord} size="sm" variant="primary">
              Create return
            </AdminButton>
          </>
        }
        contextItems={[`Orders`, `#${normalizedOrderNumber}`, "Return"]}
        onClose={() => setActiveDrawer("")}
        open={activeDrawer === "return"}
        subtitle="Returns track item movement separately from payment refunds."
        title="Start return"
      >
        <div className={styles.drawerStack}>
          {returnError ? <p className={styles.errorText}>{returnError}</p> : null}

          <AdminFormSection description="Return records can exist without an immediate payment refund." title="Return details">
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Reason</span>
                <AdminSelect
                  onChange={setReturnReason}
                  options={RETURN_REASON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  value={returnReason}
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Internal note</span>
              <AdminTextarea
                onChange={(event) => setReturnNote(event.target.value)}
                placeholder="Optional context for this return workflow."
                rows={3}
                value={returnNote}
              />
            </label>
          </AdminFormSection>

          <AdminFormSection description="Select items and quantities to include in the return record." title="Item selector">
            <div className={styles.selectorList}>
              {returnItems.map((draft) => {
                const source = orderItemById.get(draft.orderItemId);
                if (!source) return null;
                return (
                  <div className={styles.selectorRow} key={draft.orderItemId}>
                    <label className={styles.selectorCheckbox}>
                      <input
                        checked={draft.selected}
                        disabled={Number(source.remainingEligibleQuantity || 0) <= 0}
                        onChange={(event) => patchReturnDraft(draft.orderItemId, { selected: event.target.checked })}
                        type="checkbox"
                      />
                      <span>
                        {source.title} {source.variantId ? <small>({source.variantId})</small> : null}
                      </span>
                    </label>
                    <div className={styles.selectorMeta}>
                      <span>Purchased: {source.purchasedQuantity}</span>
                      <span>Remaining eligible: {source.remainingEligibleQuantity}</span>
                    </div>
                    <div className={styles.selectorInputs}>
                      <label>
                        Qty
                        <AdminInput
                          disabled={!draft.selected}
                          max={source.remainingEligibleQuantity}
                          min="1"
                          onChange={(event) => patchReturnDraft(draft.orderItemId, { quantity: event.target.value })}
                          type="number"
                          value={draft.quantity}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminFormSection>

          <AdminFormSection description="Restock for returns is controlled when refund records are created safely." title="Restock intention">
            <div className={styles.checkboxRow}>
              <label className={styles.checkboxField}>
                <input checked={false} disabled type="checkbox" />
                <span>Restock intention is captured during refund record creation.</span>
              </label>
              <AdminTooltip
                content="Use the refund record flow to request restocking when selected items are variant-safe."
                label="Restock info"
              />
            </div>
          </AdminFormSection>
        </div>
      </AdminDrawer>
    </AdminCard>
  );
}
