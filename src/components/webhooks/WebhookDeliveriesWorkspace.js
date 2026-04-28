"use client";

import { useEffect, useMemo, useState } from 'react';

import AppShell from '../AppShell';
import styles from './WebhookDeliveriesWorkspace.module.css';

const INBOUND_STATUS_OPTIONS = ['ALL', 'RECEIVED', 'PROCESSED', 'FAILED', 'SIGNATURE_FAILED', 'RETRY_PENDING', 'RETRY_EXHAUSTED'];
const OUTBOUND_STATUS_OPTIONS = ['ALL', 'PENDING', 'SUCCESS', 'FAILED', 'RETRYING', 'EXHAUSTED'];

function formatTimestamp(value, fallback = 'Not scheduled') {
  if (!value) return fallback;
  return new Date(value).toLocaleString();
}

function formatEventType(value) {
  return String(value || '').replaceAll('_', ' ').replaceAll('.', ' / ');
}

function getReplayDisabledReason(delivery) {
  if (!delivery?.hasVerifiedPayload) return 'Replay needs a verified stored payload.';
  if (delivery.providerEventId?.startsWith('unknown:')) return 'Replay needs a provider event id.';
  if (delivery.status === 'SIGNATURE_FAILED') return 'Signature failures are not replayable.';
  return '';
}

export default function WebhookDeliveriesWorkspace() {
  const [mode, setMode] = useState('inbound');
  const [deliveries, setDeliveries] = useState([]);
  const [outboundDeliveries, setOutboundDeliveries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [outboundPagination, setOutboundPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [outboundLoading, setOutboundLoading] = useState(false);
  const [replayingId, setReplayingId] = useState(null);
  const [retryingOutboundId, setRetryingOutboundId] = useState(null);
  const [inspectingId, setInspectingId] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [outboundStatus, setOutboundStatus] = useState('ALL');

  async function loadDeliveries(nextPage = 1) {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pagination.pageSize || 20),
      });
      if (search.trim()) {
        params.set('search', search.trim());
      }
      if (status !== 'ALL') {
        params.set('status', status);
      }

      const response = await fetch(`/api/webhook-deliveries?${params.toString()}`);
      const json = await response.json();
      if (!json.success) {
        setNotice(json.error || 'Webhook deliveries could not be loaded.');
        setDeliveries([]);
        return;
      }

      setDeliveries(json.data.deliveries || []);
      setPagination(json.data.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 });
      setNotice('');
    } catch (error) {
      console.error('[WebhookDeliveriesWorkspace] load failed', error);
      setNotice('Webhook deliveries could not be loaded.');
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadOutboundDeliveries(nextPage = 1) {
    setOutboundLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(outboundPagination.pageSize || 20),
      });
      if (outboundStatus !== 'ALL') {
        params.set('status', outboundStatus);
      }

      const response = await fetch(`/api/outbound-webhook-deliveries?${params.toString()}`);
      const json = await response.json();
      if (!json.success) {
        setNotice(json.error || 'Outbound webhook deliveries could not be loaded.');
        setOutboundDeliveries([]);
        return;
      }

      setOutboundDeliveries(json.data.deliveries || []);
      setOutboundPagination(json.data.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 });
      setNotice('');
    } catch (error) {
      console.error('[WebhookDeliveriesWorkspace] outbound load failed', error);
      setNotice('Outbound webhook deliveries could not be loaded.');
      setOutboundDeliveries([]);
    } finally {
      setOutboundLoading(false);
    }
  }

  useEffect(() => {
    if (mode === 'inbound') {
      loadDeliveries(1);
    }
  }, [search, status, mode]);

  useEffect(() => {
    if (mode === 'outbound') {
      loadOutboundDeliveries(1);
    }
  }, [outboundStatus, mode]);

  const retryCount = useMemo(
    () => deliveries.filter((delivery) => ['RETRY_PENDING', 'RETRY_EXHAUSTED'].includes(delivery.status)).length,
    [deliveries]
  );

  const processedCount = useMemo(
    () => deliveries.filter((delivery) => delivery.status === 'PROCESSED').length,
    [deliveries]
  );

  const outboundRetryCount = useMemo(
    () => outboundDeliveries.filter((delivery) => ['RETRYING', 'EXHAUSTED'].includes(delivery.status)).length,
    [outboundDeliveries]
  );

  const outboundSuccessCount = useMemo(
    () => outboundDeliveries.filter((delivery) => delivery.status === 'SUCCESS').length,
    [outboundDeliveries]
  );

  async function handleReplay(delivery) {
    if (!delivery?.id) {
      return;
    }

    const disabledReason = getReplayDisabledReason(delivery);
    if (disabledReason) {
      setNotice(disabledReason);
      return;
    }

    setReplayingId(delivery.id);
    setNotice('');

    try {
      const response = await fetch(`/api/webhook-deliveries/${delivery.id}/replay`, {
        method: 'POST',
      });
      const json = await response.json();

      if (!json.success) {
        setNotice(json.error || 'Webhook replay failed.');
        return;
      }

      setNotice(`Replay completed for ${delivery.providerEventId}.`);
      await loadDeliveries(pagination.page);
      await loadDiagnostics(delivery.id, false);
    } catch (error) {
      console.error('[WebhookDeliveriesWorkspace] replay failed', error);
      setNotice('Webhook replay failed.');
    } finally {
      setReplayingId(null);
    }
  }

  async function handleRetryOutbound(delivery) {
    if (!delivery?.id) return;
    setRetryingOutboundId(delivery.id);
    setNotice('');

    try {
      const response = await fetch(`/api/outbound-webhook-deliveries/${delivery.id}/retry`, {
        method: 'POST',
      });
      const json = await response.json();
      if (!json.success) {
        setNotice(json.error || 'Outbound webhook retry failed.');
        return;
      }

      setNotice(`Outbound delivery ${delivery.id.slice(0, 8)} retried.`);
      await loadOutboundDeliveries(outboundPagination.page);
    } catch (error) {
      console.error('[WebhookDeliveriesWorkspace] outbound retry failed', error);
      setNotice('Outbound webhook retry failed.');
    } finally {
      setRetryingOutboundId(null);
    }
  }

  async function loadDiagnostics(deliveryId, showLoading = true) {
    if (!deliveryId) return;

    if (showLoading) {
      setInspectingId(deliveryId);
      setDiagnostics(null);
    }

    try {
      const response = await fetch(`/api/webhook-deliveries/${deliveryId}`, {
        cache: 'no-store',
      });
      const json = await response.json();
      if (!json.success) {
        setNotice(json.error || 'Webhook diagnostics could not be loaded.');
        return;
      }

      setDiagnostics(json.data);
      setNotice('');
    } catch (error) {
      console.error('[WebhookDeliveriesWorkspace] diagnostics failed', error);
      setNotice('Webhook diagnostics could not be loaded.');
    } finally {
      if (showLoading) {
        setInspectingId(null);
      }
    }
  }

  return (
    <AppShell
      onCreateOrder={() => (mode === 'inbound' ? loadDeliveries(1) : loadOutboundDeliveries(1))}
      onNotificationsClick={() => setNotice('Webhook delivery feed is live.')}
      onQuickActionClick={() => setNotice('Use filters to narrow webhook deliveries before replay or retry.')}
      onSearchChange={(event) => setSearch(event.target.value)}
      primaryActionLabel="Refresh deliveries"
      searchPlaceholder="Search event id or error..."
      searchValue={search}
    >
      <div className={styles.page}>
        <section className={styles.panel}>
          <div className={styles.header}>
            <div>
              <p className={styles.eyebrow}>Observability</p>
              <h1 className={styles.title}>Webhook Deliveries</h1>
            </div>
            <div className={styles.stats}>
              {mode === 'inbound' ? (
                <>
                  <span>{pagination.total} inbound</span>
                  <span>{processedCount} processed</span>
                  <span>{retryCount} retry watch</span>
                </>
              ) : (
                <>
                  <span>{outboundPagination.total} outbound</span>
                  <span>{outboundSuccessCount} successful</span>
                  <span>{outboundRetryCount} retry/dead-letter</span>
                </>
              )}
            </div>
          </div>

          <div className={styles.controls}>
            <label className={styles.control}>
              <span>Direction</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="inbound">Inbound provider webhooks</option>
                <option value="outbound">Outbound merchant webhooks</option>
              </select>
            </label>
            {mode === 'inbound' ? (
              <label className={styles.control}>
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  {INBOUND_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'ALL' ? 'All statuses' : option}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className={styles.control}>
                <span>Status</span>
                <select value={outboundStatus} onChange={(event) => setOutboundStatus(event.target.value)}>
                  {OUTBOUND_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'ALL' ? 'All statuses' : option}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className={styles.refreshButton} type="button" onClick={() => (mode === 'inbound' ? loadDeliveries(pagination.page) : loadOutboundDeliveries(outboundPagination.page))}>
              Refresh
            </button>
          </div>

          {notice ? <p className={styles.notice}>{notice}</p> : null}

          {mode === 'outbound' ? (
            outboundLoading ? (
              <div className={styles.loading}>Loading outbound webhook deliveries...</div>
            ) : outboundDeliveries.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Integration</th>
                      <th>Event</th>
                      <th>Status</th>
                      <th>Attempts</th>
                      <th>Response</th>
                      <th>Next retry</th>
                      <th>Error</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {outboundDeliveries.map((delivery) => (
                      <tr key={delivery.id}>
                        <td>
                          <strong>{delivery.integration?.name || 'Integration'}</strong>
                          <span className={styles.subtle}>{delivery.integration?.webhookUrl || 'No URL'}</span>
                        </td>
                        <td>{formatEventType(delivery.event)}</td>
                        <td>{delivery.status}</td>
                        <td>
                          {delivery.attempts}
                          <span className={styles.subtle}>Last retry: {formatTimestamp(delivery.lastRetriedAt, 'Never')}</span>
                        </td>
                        <td>
                          {delivery.statusCode || '—'}
                          <span className={styles.subtle}>{delivery.responseBody || 'No response body'}</span>
                        </td>
                        <td>{formatTimestamp(delivery.nextRetryAt)}</td>
                        <td>{delivery.lastError || 'None'}</td>
                        <td className={styles.actionCell}>
                          <button
                            type="button"
                            disabled={retryingOutboundId === delivery.id}
                            onClick={() => handleRetryOutbound(delivery)}
                          >
                            {retryingOutboundId === delivery.id ? 'Retrying...' : 'Retry now'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.empty}>No outbound webhook deliveries match this filter.</div>
            )
          ) : loading ? (
            <div className={styles.loading}>Loading webhook deliveries...</div>
          ) : deliveries.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Provider event</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Next retry</th>
                    <th>Payload</th>
                    <th>Error</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => {
                    const disabledReason = getReplayDisabledReason(delivery);

                    return (
                      <tr key={delivery.id}>
                        <td>
                          <strong>{delivery.providerEventId}</strong>
                          <span className={styles.subtle}>{delivery.payloadHash}</span>
                        </td>
                        <td>{formatEventType(delivery.eventType)}</td>
                        <td>{delivery.status}</td>
                        <td>
                          {delivery.attempts}
                          <span className={styles.subtle}>Last retry: {formatTimestamp(delivery.lastRetriedAt, 'Never')}</span>
                        </td>
                        <td>{formatTimestamp(delivery.nextRetryAt)}</td>
                        <td>{delivery.hasVerifiedPayload ? 'Verified local payload' : 'Hash only'}</td>
                        <td>{delivery.lastError || 'None'}</td>
                        <td className={styles.actionCell}>
                          <button
                            type="button"
                            disabled={replayingId === delivery.id || Boolean(disabledReason)}
                            title={disabledReason || 'Replay stored payload'}
                            onClick={() => handleReplay(delivery)}
                          >
                            {replayingId === delivery.id ? 'Replaying...' : 'Replay'}
                          </button>
                          <button
                            type="button"
                            disabled={inspectingId === delivery.id}
                            onClick={() => loadDiagnostics(delivery.id)}
                          >
                            {inspectingId === delivery.id ? 'Inspecting...' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>No webhook deliveries match this filter.</div>
          )}

          {mode === 'inbound' && diagnostics ? (
            <aside className={styles.diagnostics}>
              <div>
                <p className={styles.eyebrow}>Support diagnostics</p>
                <h2>{diagnostics.delivery.providerEventId}</h2>
              </div>
              <div className={styles.diagnosticGrid}>
                <div>
                  <span>Status</span>
                  <strong>{diagnostics.delivery.status}</strong>
                </div>
                <div>
                  <span>Verified payload</span>
                  <strong>{diagnostics.delivery.hasVerifiedPayload ? `${diagnostics.delivery.rawPayloadBytes} bytes` : 'No'}</strong>
                </div>
                <div>
                  <span>Can retry</span>
                  <strong>{diagnostics.retryPolicy.canRetry ? 'Yes' : 'No'}</strong>
                </div>
                <div>
                  <span>Payment intent</span>
                  <strong>{diagnostics.related.paymentIntentId || 'Unknown'}</strong>
                </div>
                <div>
                  <span>Checkout</span>
                  <strong>{diagnostics.related.checkoutSession?.status || 'Missing'}</strong>
                </div>
                <div>
                  <span>Order</span>
                  <strong>{diagnostics.related.order?.orderNumber ? `#${diagnostics.related.order.orderNumber}` : 'Missing'}</strong>
                </div>
              </div>
              {diagnostics.retryPolicy.retryBlockers.length ? (
                <p className={styles.notice}>Retry blockers: {diagnostics.retryPolicy.retryBlockers.join(' ')}</p>
              ) : (
                <p className={styles.notice}>This delivery is eligible for automated retry when due.</p>
              )}
            </aside>
          ) : null}

          <div className={styles.pagination}>
            {mode === 'inbound' ? (
              <>
                <button
                  type="button"
                  disabled={loading || pagination.page <= 1}
                  onClick={() => loadDeliveries(pagination.page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <button
                  type="button"
                  disabled={loading || pagination.page >= (pagination.totalPages || 1)}
                  onClick={() => loadDeliveries(pagination.page + 1)}
                >
                  Next
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={outboundLoading || outboundPagination.page <= 1}
                  onClick={() => loadOutboundDeliveries(outboundPagination.page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {outboundPagination.page} of {outboundPagination.totalPages || 1}
                </span>
                <button
                  type="button"
                  disabled={outboundLoading || outboundPagination.page >= (outboundPagination.totalPages || 1)}
                  onClick={() => loadOutboundDeliveries(outboundPagination.page + 1)}
                >
                  Next
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
