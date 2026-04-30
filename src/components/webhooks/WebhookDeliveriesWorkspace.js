"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import AppShell from '../AppShell';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminEmptyState from '../admin/ui/AdminEmptyState';
import AdminInput from '../admin/ui/AdminInput';
import AdminPage from '../admin/ui/AdminPage';
import AdminPageHeader from '../admin/ui/AdminPageHeader';
import AdminSelect from '../admin/ui/AdminSelect';
import AdminStatCard, { AdminStatsGrid } from '../admin/ui/AdminStatCard';
import AdminStatusChip from '../admin/ui/AdminStatusChip';
import AdminTable from '../admin/ui/AdminTable';
import AdminToolbar from '../admin/ui/AdminToolbar';
import styles from './WebhookDeliveriesWorkspace.module.css';

const INBOUND_STATUS_OPTIONS = ['ALL', 'RECEIVED', 'PROCESSED', 'FAILED', 'SIGNATURE_FAILED', 'RETRY_PENDING', 'RETRY_EXHAUSTED'];
const OUTBOUND_STATUS_OPTIONS = ['ALL', 'PENDING', 'SUCCESS', 'FAILED', 'RETRYING', 'EXHAUSTED'];
const EMAIL_STATUS_OPTIONS = ['ALL', 'PENDING', 'SENT', 'FAILED', 'BOUNCED', 'COMPLAINED', 'RETRYING', 'RESEND_REQUESTED'];
const EMAIL_TEMPLATE_OPTIONS = [
  { value: 'ALL', label: 'All templates' },
  { value: 'order_confirmation', label: 'Order confirmation' },
  { value: 'fulfillment_tracking', label: 'Fulfillment tracking' },
];
const EMAIL_RESEND_ELIGIBLE_STATUSES = ['FAILED', 'BOUNCED', 'COMPLAINED'];

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

function getEmailResendDisabledReason(delivery) {
  if (!delivery) return 'Email delivery is unavailable.';
  if (!EMAIL_RESEND_ELIGIBLE_STATUSES.includes(delivery.status)) return 'Only failed, bounced, or complained deliveries can be resent.';
  if (delivery.template !== 'order_confirmation') return 'Only order confirmation deliveries support safe resend.';
  if (!delivery.orderId) return 'Safe resend requires a linked order.';
  return '';
}

const toSelectOptions = (values, allLabel) => [{ value: 'ALL', label: allLabel }, ...values.map((value) => ({ value, label: value }))];

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
  const [emailTemplate, setEmailTemplate] = useState('ALL');

  const loadDeliveries = useCallback(async (nextPage = 1) => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pagination.pageSize || 20),
      });
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'ALL') params.set('status', status);

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
      if (outboundStatus !== 'ALL') params.set('status', outboundStatus);

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
      if (emailStatus !== 'ALL') params.set('status', emailStatus);
      if (emailTemplate !== 'ALL') params.set('template', emailTemplate);

      const response = await fetch(`/api/email-deliveries?${params.toString()}`, { cache: 'no-store' });
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
  }, [emailPagination.pageSize, emailStatus, emailTemplate]);

  useEffect(() => {
    if (mode === 'inbound') loadDeliveries(1);
  }, [mode, loadDeliveries]);

  useEffect(() => {
    if (mode === 'outbound') loadOutboundDeliveries(1);
  }, [mode, loadOutboundDeliveries]);

  useEffect(() => {
    if (mode === 'email') loadEmailDeliveries(1);
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
    if (!delivery?.id) return;

    const disabledReason = getReplayDisabledReason(delivery);
    if (disabledReason) {
      setNotice(disabledReason);
      return;
    }

    setReplayingId(delivery.id);
    setNotice('');

    try {
      const response = await fetch(`/api/webhook-deliveries/${delivery.id}/replay`, { method: 'POST' });
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
      const response = await fetch(`/api/outbound-webhook-deliveries/${delivery.id}/retry`, { method: 'POST' });
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
      const response = await fetch(`/api/email-deliveries/${delivery.id}/resend`, { method: 'POST' });
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
      const response = await fetch(`/api/webhook-deliveries/${deliveryId}`, { cache: 'no-store' });
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
      if (showLoading) setInspectingId(null);
    }
  }

  async function loadEmailDiagnostics(deliveryId, showLoading = true) {
    if (!deliveryId) return;

    if (showLoading) {
      setEmailInspectingId(deliveryId);
      setEmailDiagnostics(null);
    }

    try {
      const response = await fetch(`/api/email-deliveries/${deliveryId}`, { cache: 'no-store' });
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
      if (showLoading) setEmailInspectingId(null);
    }
  }

  const isInbound = mode === 'inbound';
  const isOutbound = mode === 'outbound';
  const isEmail = mode === 'email';

  const activeRows = isInbound ? deliveries : isOutbound ? outboundDeliveries : emailDeliveries;
  const activeLoading = isInbound ? loading : isOutbound ? outboundLoading : emailLoading;

  const columns = useMemo(() => {
    if (isOutbound) {
      return [
        {
          key: 'integration',
          header: 'Integration',
          render: (delivery) => (
            <div className={styles.cellStack}>
              <strong>{delivery.integration?.name || 'Integration'}</strong>
              <small>{delivery.integration?.webhookUrl || 'No URL'}</small>
            </div>
          ),
        },
        { key: 'event', header: 'Event', render: (delivery) => formatEventType(delivery.event) },
        { key: 'status', header: 'Status', render: (delivery) => <AdminStatusChip tone={delivery.status === 'SUCCESS' ? 'success' : delivery.status === 'EXHAUSTED' ? 'danger' : 'warning'}>{delivery.status}</AdminStatusChip> },
        {
          key: 'attempts',
          header: 'Attempts',
          render: (delivery) => (
            <div className={styles.cellStack}>
              <strong>{delivery.attempts}</strong>
              <small>Last retry: {formatTimestamp(delivery.lastRetriedAt, 'Never')}</small>
            </div>
          ),
        },
        { key: 'response', header: 'Response', render: (delivery) => delivery.statusCode || '-' },
        {
          key: 'actions',
          header: '',
          render: (delivery) => (
            <AdminButton disabled={retryingOutboundId === delivery.id} onClick={() => handleRetryOutbound(delivery)} size="sm" variant="secondary">
              {retryingOutboundId === delivery.id ? 'Retrying...' : 'Retry now'}
            </AdminButton>
          ),
        },
      ];
    }

    if (isEmail) {
      return [
        {
          key: 'recipient',
          header: 'Recipient',
          render: (delivery) => (
            <div className={styles.cellStack}>
              <strong>{delivery.recipientEmail}</strong>
              <small>{delivery.subject}</small>
            </div>
          ),
        },
        { key: 'template', header: 'Template', render: (delivery) => formatEventType(delivery.template) },
        { key: 'status', header: 'Status', render: (delivery) => <AdminStatusChip tone={delivery.status === 'SENT' ? 'success' : EMAIL_RESEND_ELIGIBLE_STATUSES.includes(delivery.status) ? 'danger' : 'warning'}>{delivery.status}</AdminStatusChip> },
        { key: 'attempts', header: 'Attempts', render: (delivery) => delivery.attempts },
        { key: 'provider', header: 'Provider', render: (delivery) => delivery.provider },
        {
          key: 'actions',
          header: '',
          render: (delivery) => {
            const resendDisabledReason = getEmailResendDisabledReason(delivery);
            return (
              <div className={styles.actionGroup}>
                <AdminButton disabled={emailInspectingId === delivery.id} onClick={() => loadEmailDiagnostics(delivery.id)} size="sm" variant="secondary">
                  {emailInspectingId === delivery.id ? 'Loading...' : 'View'}
                </AdminButton>
                <AdminButton
                  disabled={resendingEmailId === delivery.id || Boolean(resendDisabledReason)}
                  onClick={() => handleResendEmail(delivery)}
                  size="sm"
                  title={resendDisabledReason || 'Safely resend this transactional email'}
                  variant="secondary"
                >
                  {resendingEmailId === delivery.id ? 'Resending...' : 'Resend'}
                </AdminButton>
              </div>
            );
          },
        },
      ];
    }

    return [
      {
        key: 'event',
        header: 'Provider event',
        render: (delivery) => (
          <div className={styles.cellStack}>
            <strong>{delivery.providerEventId}</strong>
            <small>{delivery.payloadHash}</small>
          </div>
        ),
      },
      { key: 'type', header: 'Type', render: (delivery) => formatEventType(delivery.eventType) },
      { key: 'status', header: 'Status', render: (delivery) => <AdminStatusChip tone={delivery.status === 'PROCESSED' ? 'success' : delivery.status === 'FAILED' ? 'danger' : 'warning'}>{delivery.status}</AdminStatusChip> },
      {
        key: 'attempts',
        header: 'Attempts',
        render: (delivery) => (
          <div className={styles.cellStack}>
            <strong>{delivery.attempts}</strong>
            <small>Last retry: {formatTimestamp(delivery.lastRetriedAt, 'Never')}</small>
          </div>
        ),
      },
      { key: 'payload', header: 'Payload', render: (delivery) => delivery.hasVerifiedPayload ? 'Verified local payload' : 'Hash only' },
      {
        key: 'actions',
        header: '',
        render: (delivery) => {
          const disabledReason = getReplayDisabledReason(delivery);
          return (
            <div className={styles.actionGroup}>
              <AdminButton
                disabled={replayingId === delivery.id || Boolean(disabledReason)}
                onClick={() => handleReplay(delivery)}
                size="sm"
                title={disabledReason || 'Replay stored payload'}
                variant="secondary"
              >
                {replayingId === delivery.id ? 'Replaying...' : 'Replay'}
              </AdminButton>
              <AdminButton disabled={inspectingId === delivery.id} onClick={() => loadDiagnostics(delivery.id)} size="sm" variant="secondary">
                {inspectingId === delivery.id ? 'Inspecting...' : 'Inspect'}
              </AdminButton>
            </div>
          );
        },
      },
    ];
  }, [
    emailInspectingId,
    inspectingId,
    isEmail,
    isOutbound,
    replayingId,
    resendingEmailId,
    retryingOutboundId,
  ]);

  const currentPage = isInbound ? pagination.page : isOutbound ? outboundPagination.page : emailPagination.page;
  const totalPages = isInbound ? (pagination.totalPages || 1) : isOutbound ? (outboundPagination.totalPages || 1) : (emailPagination.totalPages || 1);

  const changePage = (nextPage) => {
    if (isInbound) return loadDeliveries(nextPage);
    if (isOutbound) return loadOutboundDeliveries(nextPage);
    return loadEmailDeliveries(nextPage);
  };

  return (
    <AppShell>
      <AdminPage>
        <AdminPageHeader
          description="Inbound provider webhooks, outbound merchant webhooks, and transactional email delivery visibility."
          eyebrow="Observability"
          title="Webhook and email deliveries"
          actions={<AdminButton onClick={() => changePage(currentPage)} size="sm" variant="secondary">Refresh</AdminButton>}
        />

        <AdminStatsGrid>
          {isInbound ? (
            <>
              <AdminStatCard label="Inbound" value={String(pagination.total)} />
              <AdminStatCard label="Processed" value={String(processedCount)} />
              <AdminStatCard label="Retry watch" value={String(retryCount)} />
              <AdminStatCard label="Page" value={`${pagination.page}/${pagination.totalPages || 1}`} />
            </>
          ) : isOutbound ? (
            <>
              <AdminStatCard label="Outbound" value={String(outboundPagination.total)} />
              <AdminStatCard label="Successful" value={String(outboundSuccessCount)} />
              <AdminStatCard label="Retry/dead-letter" value={String(outboundRetryCount)} />
              <AdminStatCard label="Page" value={`${outboundPagination.page}/${outboundPagination.totalPages || 1}`} />
            </>
          ) : (
            <>
              <AdminStatCard label="Emails" value={String(emailPagination.total)} />
              <AdminStatCard label="Sent" value={String(emailSentCount)} />
              <AdminStatCard label="Needs attention" value={String(emailRetryWatchCount)} />
              <AdminStatCard label="Page" value={`${emailPagination.page}/${emailPagination.totalPages || 1}`} />
            </>
          )}
        </AdminStatsGrid>

        <AdminCard className={styles.panel} variant="panel">
          <AdminToolbar
            actions={
              <AdminSelect
                onChange={(value) => {
                  setMode(value);
                  setNotice('');
                }}
                options={[
                  { value: 'inbound', label: 'Inbound provider webhooks' },
                  { value: 'outbound', label: 'Outbound merchant webhooks' },
                  { value: 'email', label: 'Transactional email deliveries' },
                ]}
                value={mode}
              />
            }
          >
            {isInbound ? (
              <>
                <AdminSelect onChange={setStatus} options={toSelectOptions(INBOUND_STATUS_OPTIONS, 'All statuses')} value={status} />
                <AdminInput
                  className={styles.searchInput}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search provider event id or error..."
                  type="search"
                  value={search}
                />
              </>
            ) : null}

            {isOutbound ? (
              <AdminSelect onChange={setOutboundStatus} options={toSelectOptions(OUTBOUND_STATUS_OPTIONS, 'All statuses')} value={outboundStatus} />
            ) : null}

            {isEmail ? (
              <>
                <AdminSelect onChange={setEmailStatus} options={toSelectOptions(EMAIL_STATUS_OPTIONS, 'All statuses')} value={emailStatus} />
                <AdminSelect onChange={setEmailTemplate} options={EMAIL_TEMPLATE_OPTIONS} value={emailTemplate} />
              </>
            ) : null}
          </AdminToolbar>

          {notice ? <p className={styles.notice}>{notice}</p> : null}

          {activeRows.length || activeLoading ? (
            <AdminTable columns={columns} isLoading={activeLoading} rows={activeRows} />
          ) : (
            <AdminEmptyState
              description={isInbound ? 'No webhook deliveries match this filter.' : isOutbound ? 'No outbound deliveries match this filter.' : 'No email deliveries match this filter.'}
              icon="sync_problem"
              title="No deliveries"
            />
          )}

          {isInbound && diagnostics ? (
            <AdminCard className={styles.diagnostics} variant="card">
              <h3>Support diagnostics</h3>
              <p>{diagnostics.delivery.providerEventId}</p>
              <div className={styles.diagnosticGrid}>
                <div><span>Status</span><strong>{diagnostics.delivery.status}</strong></div>
                <div><span>Verified payload</span><strong>{diagnostics.delivery.hasVerifiedPayload ? `${diagnostics.delivery.rawPayloadBytes} bytes` : 'No'}</strong></div>
                <div><span>Can retry</span><strong>{diagnostics.retryPolicy.canRetry ? 'Yes' : 'No'}</strong></div>
                <div><span>Payment intent</span><strong>{diagnostics.related.paymentIntentId || 'Unknown'}</strong></div>
              </div>
            </AdminCard>
          ) : null}

          {isEmail && emailDiagnostics ? (
            <AdminCard className={styles.diagnostics} variant="card">
              <h3>Email details</h3>
              <p>{emailDiagnostics.delivery.recipientEmail}</p>
              <div className={styles.diagnosticGrid}>
                <div><span>Status</span><strong>{emailDiagnostics.delivery.status}</strong></div>
                <div><span>Template</span><strong>{formatEventType(emailDiagnostics.delivery.template)}</strong></div>
                <div><span>Can resend</span><strong>{emailDiagnostics.resendPolicy.canResend ? 'Yes' : 'No'}</strong></div>
                <div><span>Provider</span><strong>{emailDiagnostics.delivery.provider}</strong></div>
              </div>
            </AdminCard>
          ) : null}

          <div className={styles.pagination}>
            <AdminButton disabled={activeLoading || currentPage <= 1} onClick={() => changePage(currentPage - 1)} size="sm" variant="secondary">Previous</AdminButton>
            <span>Page {currentPage} of {totalPages}</span>
            <AdminButton disabled={activeLoading || currentPage >= totalPages} onClick={() => changePage(currentPage + 1)} size="sm" variant="secondary">Next</AdminButton>
          </div>
        </AdminCard>
      </AdminPage>
    </AppShell>
  );
}
