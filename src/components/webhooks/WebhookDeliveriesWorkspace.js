"use client";

import { useEffect, useMemo, useState } from 'react';

import AppShell from '../AppShell';
import styles from './WebhookDeliveriesWorkspace.module.css';

const STATUS_OPTIONS = ['ALL', 'RECEIVED', 'PROCESSED', 'FAILED', 'SIGNATURE_FAILED'];

function formatTimestamp(value) {
  if (!value) return 'Not processed';
  return new Date(value).toLocaleString();
}

function formatEventType(value) {
  return String(value || '').replaceAll('_', ' ').replaceAll('.', ' / ');
}

export default function WebhookDeliveriesWorkspace() {
  const [deliveries, setDeliveries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [replayingId, setReplayingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

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

  useEffect(() => {
    loadDeliveries(1);
  }, [search, status]);

  const processedCount = useMemo(
    () => deliveries.filter((delivery) => delivery.status === 'PROCESSED').length,
    [deliveries]
  );

  async function handleReplay(delivery) {
    if (!delivery?.id) {
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
    } catch (error) {
      console.error('[WebhookDeliveriesWorkspace] replay failed', error);
      setNotice('Webhook replay failed.');
    } finally {
      setReplayingId(null);
    }
  }

  return (
    <AppShell
      onCreateOrder={() => loadDeliveries(1)}
      onNotificationsClick={() => setNotice('Webhook delivery feed is live.')}
      onQuickActionClick={() => setNotice('Use filters to narrow provider events before replay.')}
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
              <span>{pagination.total} total</span>
              <span>{processedCount} processed</span>
            </div>
          </div>

          <div className={styles.controls}>
            <label className={styles.control}>
              <span>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All statuses' : option}
                  </option>
                ))}
              </select>
            </label>
            <button className={styles.refreshButton} type="button" onClick={() => loadDeliveries(pagination.page)}>
              Refresh
            </button>
          </div>

          {notice ? <p className={styles.notice}>{notice}</p> : null}

          {loading ? (
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
                    <th>Processed</th>
                    <th>Error</th>
                    <th>Payload hash</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td>{delivery.providerEventId}</td>
                      <td>{formatEventType(delivery.eventType)}</td>
                      <td>{delivery.status}</td>
                      <td>{delivery.attempts}</td>
                      <td>{formatTimestamp(delivery.processedAt)}</td>
                      <td>{delivery.lastError || 'None'}</td>
                      <td className={styles.hashCell}>{delivery.payloadHash}</td>
                      <td className={styles.actionCell}>
                        <button
                          type="button"
                          disabled={replayingId === delivery.id || delivery.providerEventId.startsWith('unknown:')}
                          onClick={() => handleReplay(delivery)}
                        >
                          {replayingId === delivery.id ? 'Replaying...' : 'Replay'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>No webhook deliveries match this filter.</div>
          )}

          <div className={styles.pagination}>
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
          </div>
        </section>
      </div>
    </AppShell>
  );
}
