"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import AppShell from '../AppShell';
import styles from './WebhookDeliveriesWorkspace.module.css';

const INBOUND_STATUS_OPTIONS = ['ALL', 'RECEIVED', 'PROCESSED', 'FAILED', 'SIGNATURE_FAILED', 'RETRY_PENDING', 'RETRY_EXHAUSTED'];
const OUTBOUND_STATUS_OPTIONS = ['ALL', 'PENDING', 'SUCCESS', 'FAILED', 'RETRYING', 'EXHAUSTED'];
const EMAIL_STATUS_OPTIONS = ['ALL', 'PENDING', 'SENT', 'FAILED', 'BOUNCED', 'COMPLAINED', 'RETRYING', 'RESEND_REQUESTED'];

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

function getModeLabel(mode) {
  if (mode === 'outbound') return 'Outbound merchant webhooks';
  if (mode === 'email') return 'Transactional email deliveries';
  return 'Inbound provider webhooks';
}

export default function WebhookDeliveriesWorkspace() {
  const [mode, setMode] = useState('inbound');

  const [deliveries, setDeliveries] = useState([]);
  const [outboundDeliveries, setOutboundDeliveries] = useState([]);
  const [emailDeliveries, setEmailDeliveries] = useState([]);

  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [outboundPagination, setOutboundPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [emailPagination, setEmailPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });

  const [loading, setLoading] = useState(true);
  const [outboundLoading, setOutboundLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const [replayingId, setReplayingId] = useState(null);
  const [retryingOutboundId, setRetryingOutboundId] = useState(null);
  const [resendingEmailId, setResendingEmailId] = useState(null);

  const [inspectingId, setInspectingId] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [emailInspectingId, setEmailInspectingId] = useState(null);
  const [emailDiagnostics, setEmailDiagnostics] = useState(null);

  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [outboundStatus, setOutboundStatus] = useState('ALL');
  const [emailStatus, setEmailStatus] = useState('ALL');

  const loadDeliveries = useCallback(async (nextPage = 1) => {
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
  }, [pagination.pageSize, search, status]);

  const loadOutboundDeliveries = useCallback(async (nextPage = 1) => {
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
  }, [outboundPagination.pageSize, outboundStatus]);

  const loadEmailDeliveries = useCallback(async (nextPage = 1) => {
    setEmailLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(emailPagination.pageSize || 20),
      });
      if (emailStatus !== 'ALL') {
        params.set('status', emailStatus);
      }

      const response = await fetch(`/api/email-deliveries?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await response.json();
      if (!json.success) {
        setNotice(json.error || 'Email deliveries could not be loaded.');
        setEmailDeliveries([]);
        return;
      }

      setEmailDeliveries(json.data.deliveries || []);
      setEmailPagination(json.data.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 });
      setNotice('');
    } catch (error) {
      console.error('[WebhookDeliveriesWorkspace] email load failed', error);
      setNotice('Email deliveries could not be loaded.');
      setEmailDeliveries([]);
    } finally {
      setEmailLoading(false);
    }
  }, [emailPagination.pageSize, emailStatus]);

  useEffect(() => {
    if (mode === 'inbound') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadDeliveries(1);
    }
  }, [mode, loadDeliveries]);

  useEffect(() => {
    if (mode === 'outbound') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadOutboundDeliveries(1);
    }
  }, [mode, loadOutboundDeliveries]);

  useEffect(() => {
    if (mode === 'email') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadEmailDeliveries(1);
    }
  }, [mode, loadEmailDeliveries]);

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

  const emailRetryWatchCount = useMemo(
    () => emailDeliveries.filter((delivery) => ['FAILED', 'BOUNCED', 'COMPLAINED', 'RETRYING'].includes(delivery.status)).length,
    [emailDeliveries]
  );

  const emailSentCount = useMemo(
    () => emailDeliveries.filter((delivery) => delivery.status === 'SENT').length,
    [emailDeliveries]
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

  async function handleResendEmail(delivery) {
    if (!delivery?.id) return;
    setResendingEmailId(delivery.id);
    setNotice('');

    try {
      const response = await fetch(`/api/email-deliveries/${delivery.id}/resend`, {
        method: 'POST',
      });
      const json = await response.json();
      if (!json.success) {
        setNotice(json.error || 'Email resend failed.');
        return;
      }

      const resentId = json.data?.id ? String(json.data.id).slice(0, 8) : 'new delivery';
      setNotice(`Email resent successfully (${resentId}).`);
      await loadEmailDeliveries(emailPagination.page);
      await loadEmailDiagnostics(delivery.id, false);
    } catch (error) {
      console.error('[WebhookDeliveriesWorkspace] email resend failed', error);
      setNotice('Email resend failed.');
    } finally {
      setResendingEmailId(null);
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

  async function loadEmailDiagnostics(deliveryId, showLoading = true) {
    if (!deliveryId) return;

    if (showLoading) {
      setEmailInspectingId(deliveryId);
      setEmailDiagnostics(null);
    }

    try {
      const response = await fetch(`/api/email-deliveries/${deliveryId}`, {
        cache: 'no-store',
      });
      const json = await response.json();
      if (!json.success) {
        setNotice(json.error || 'Email delivery details could not be loaded.');
        return;
      }

      setEmailDiagnostics(json.data);
      setNotice('');
    } catch (error) {
      console.error('[WebhookDeliveriesWorkspace] email diagnostics failed', error);
      setNotice('Email delivery details could not be loaded.');
    } finally {
      if (showLoading) {
        setEmailInspectingId(null);
      }
    }
  }

  return (
    <AppShell
      onCreateOrder={() => {
        if (mode === 'outbound') return loadOutboundDeliveries(1);
        if (mode === 'email') return loadEmailDeliveries(1);
        return loadDeliveries(1);
      }}
      onNotificationsClick={() => setNotice(`${getModeLabel(mode)} feed is live.`)}
      onQuickActionClick={() => {
        if (mode === 'email') {
          setNotice('Use status filters and inspect delivery details before resending.');
          return;
        }

        setNotice('Use filters to narrow webhook deliveries before replay or retry.');
      }}
      onSearchChange={(event) => {
        if (mode === 'inbound') {
          setSearch(event.target.value);
        }
      }}
      primaryActionLabel="Refresh deliveries"
      searchPlaceholder={mode === 'inbound' ? 'Search event id or error...' : 'Search is available for inbound webhooks'}
      searchValue={mode === 'inbound' ? search : ''}
    >
      <div className={styles.page}>
        <section className={styles.panel}>
          <div className={styles.header}>
            <div>
              <p className={styles.eyebrow}>Observability</p>
              <h1 className={styles.title}>Webhook and Email Deliveries</h1>
            </div>
            <div className={styles.stats}>
              {mode === 'inbound' ? (
                <>
                  <span>{pagination.total} inbound</span>
                  <span>{processedCount} processed</span>
                  <span>{retryCount} retry watch</span>
                </>
              ) : mode === 'outbound' ? (
                <>
                  <span>{outboundPagination.total} outbound</span>
                  <span>{outboundSuccessCount} successful</span>
                  <span>{outboundRetryCount} retry/dead-letter</span>
                </>
              ) : (
                <>
                  <span>{emailPagination.total} emails</span>
                  <span>{emailSentCount} sent</span>
                  <span>{emailRetryWatchCount} attention needed</span>
                </>
              )}
            </div>
          </div>

          <div className={styles.controls}>
            <label className={styles.control}>
              <span>Surface</span>
              <select
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value);
                  setNotice('');
                }}
              >
                <option value="inbound">Inbound provider webhooks</option>
                <option value="outbound">Outbound merchant webhooks</option>
                <option value="email">Transactional email deliveries</option>
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
            ) : mode === 'outbound' ? (
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
            ) : (
              <label className={styles.control}>
                <span>Status</span>
                <select value={emailStatus} onChange={(event) => setEmailStatus(event.target.value)}>
                  {EMAIL_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'ALL' ? 'All statuses' : option}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className={styles.refreshButton}
              type="button"
              onClick={() => {
                if (mode === 'outbound') return loadOutboundDeliveries(outboundPagination.page);
                if (mode === 'email') return loadEmailDeliveries(emailPagination.page);
                return loadDeliveries(pagination.page);
              }}
            >
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
                          {delivery.statusCode || '-' }
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
          ) : mode === 'email' ? (
            emailLoading ? (
              <div className={styles.loading}>Loading email deliveries...</div>
            ) : emailDeliveries.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Template</th>
                      <th>Status</th>
                      <th>Attempts</th>
                      <th>Provider</th>
                      <th>Sent</th>
                      <th>Error</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {emailDeliveries.map((delivery) => (
                      <tr key={delivery.id}>
                        <td>
                          <strong>{delivery.recipientEmail}</strong>
                          <span className={styles.subtle}>{delivery.subject}</span>
                        </td>
                        <td>
                          {formatEventType(delivery.template)}
                          <span className={styles.subtle}>{formatEventType(delivery.event)}</span>
                        </td>
                        <td>{delivery.status}</td>
                        <td>{delivery.attempts}</td>
                        <td>
                          {delivery.provider}
                          <span className={styles.subtle}>{delivery.providerMessageId || 'No provider message id'}</span>
                        </td>
                        <td>{formatTimestamp(delivery.sentAt, 'Not sent')}</td>
                        <td>{delivery.lastError || 'None'}</td>
                        <td className={styles.actionCell}>
                          <button
                            type="button"
                            disabled={emailInspectingId === delivery.id}
                            onClick={() => loadEmailDiagnostics(delivery.id)}
                          >
                            {emailInspectingId === delivery.id ? 'Loading...' : 'View'}
                          </button>
                          <button
                            type="button"
                            disabled={resendingEmailId === delivery.id}
                            onClick={() => handleResendEmail(delivery)}
                          >
                            {resendingEmailId === delivery.id ? 'Resending...' : 'Resend'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.empty}>No email deliveries match this filter.</div>
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

          {mode === 'email' && emailDiagnostics ? (
            <aside className={styles.diagnostics}>
              <div>
                <p className={styles.eyebrow}>Email details</p>
                <h2>{emailDiagnostics.delivery.recipientEmail}</h2>
              </div>
              <div className={styles.diagnosticGrid}>
                <div>
                  <span>Status</span>
                  <strong>{emailDiagnostics.delivery.status}</strong>
                </div>
                <div>
                  <span>Template</span>
                  <strong>{formatEventType(emailDiagnostics.delivery.template)}</strong>
                </div>
                <div>
                  <span>Can resend</span>
                  <strong>{emailDiagnostics.resendPolicy.canResend ? 'Yes' : 'No'}</strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{emailDiagnostics.delivery.provider}</strong>
                </div>
                <div>
                  <span>Provider message id</span>
                  <strong>{emailDiagnostics.delivery.providerMessageId || 'Unavailable'}</strong>
                </div>
                <div>
                  <span>Order</span>
                  <strong>{emailDiagnostics.related.order?.orderNumber ? `#${emailDiagnostics.related.order.orderNumber}` : 'Missing'}</strong>
                </div>
              </div>
              {emailDiagnostics.resendPolicy.blockers.length ? (
                <p className={styles.notice}>Resend blockers: {emailDiagnostics.resendPolicy.blockers.join(' ')}</p>
              ) : (
                <p className={styles.notice}>This email delivery is eligible for safe resend.</p>
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
            ) : mode === 'outbound' ? (
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
            ) : (
              <>
                <button
                  type="button"
                  disabled={emailLoading || emailPagination.page <= 1}
                  onClick={() => loadEmailDeliveries(emailPagination.page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {emailPagination.page} of {emailPagination.totalPages || 1}
                </span>
                <button
                  type="button"
                  disabled={emailLoading || emailPagination.page >= (emailPagination.totalPages || 1)}
                  onClick={() => loadEmailDeliveries(emailPagination.page + 1)}
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
