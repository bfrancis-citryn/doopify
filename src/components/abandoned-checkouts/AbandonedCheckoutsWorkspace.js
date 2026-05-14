"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import AppShell from '@/components/AppShell';
import AdminButton from '@/components/admin/ui/AdminButton';
import AdminCard from '@/components/admin/ui/AdminCard';
import AdminEmptyState from '@/components/admin/ui/AdminEmptyState';
import AdminPage from '@/components/admin/ui/AdminPage';
import AdminPageHeader from '@/components/admin/ui/AdminPageHeader';
import AdminStatCard, { AdminStatsGrid } from '@/components/admin/ui/AdminStatCard';
import AdminStatusChip from '@/components/admin/ui/AdminStatusChip';
import AdminTable from '@/components/admin/ui/AdminTable';
import AdminToolbar from '@/components/admin/ui/AdminToolbar';
import { useSettings } from '@/context/SettingsContext';
import { formatDateTimeForDisplay } from '@/lib/date-time-format';
import styles from './AbandonedCheckoutsWorkspace.module.css';

function formatMoneyFromCents(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((Number(cents) || 0) / 100);
}

function formatTime(value, timeZone) {
  return formatDateTimeForDisplay(value, { timeZone, fallbackText: '-' });
}

export default function AbandonedCheckoutsWorkspace() {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [checkouts, setCheckouts] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [notice, setNotice] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [runningDue, setRunningDue] = useState(false);

  const loadCheckouts = useCallback(async (nextPage = page) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/abandoned-checkouts?page=${nextPage}&pageSize=20`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Failed to load abandoned checkouts');
      setCheckouts(payload.data?.checkouts ?? []);
      setPagination(payload.data?.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 });
      setPage(nextPage);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to load abandoned checkouts');
      setCheckouts([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional effect-driven state sync for existing async/load flow
    void loadCheckouts(1);
  }, [loadCheckouts]);

  const stats = useMemo(() => {
    const recovered = checkouts.filter((checkout) => !!checkout.recoveredAt).length;
    const due = checkouts.filter((checkout) => !checkout.recoveredAt).length;
    const emailsSent = checkouts.reduce((total, checkout) => total + (Number(checkout.recoveryEmailCount) || 0), 0);
    return { recovered, due, emailsSent };
  }, [checkouts]);

  async function handleSendRecovery(id) {
    if (!id) return;
    setSendingId(id);
    setNotice('');
    try {
      const response = await fetch(`/api/abandoned-checkouts/${id}/send-recovery`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Recovery email send failed');
      setNotice('Recovery email sent.');
      await loadCheckouts(page);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Recovery email send failed');
    } finally {
      setSendingId(null);
    }
  }

  async function handleSendDue() {
    setRunningDue(true);
    setNotice('');
    try {
      const response = await fetch('/api/abandoned-checkouts/send-due?limit=50', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Due recovery processing failed');
      const summary = payload.data;
      setNotice(`Due run complete. Marked ${summary.markedAbandoned}, attempted ${summary.emailsAttempted}, sent ${summary.emailsSent}, failed ${summary.emailsFailed}, skipped ${summary.skipped}.`);
      await loadCheckouts(page);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Due recovery processing failed');
    } finally {
      setRunningDue(false);
    }
  }

  async function handleMarkDue() {
    setRunningDue(true);
    setNotice('');
    try {
      const response = await fetch('/api/abandoned-checkouts/mark-due', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Failed to mark abandoned checkouts');
      setNotice(`Marked ${payload.data?.markedAbandoned ?? 0} checkouts as abandoned.`);
      await loadCheckouts(page);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to mark abandoned checkouts');
    } finally {
      setRunningDue(false);
    }
  }

  return (
    <AppShell searchPlaceholder="Search not yet enabled">
      <AdminPage>
        <AdminPageHeader
          actions={(
            <>
              <AdminButton disabled={runningDue} onClick={handleMarkDue} size="sm" variant="secondary">{runningDue ? 'Working...' : 'Mark due abandoned'}</AdminButton>
              <AdminButton disabled={runningDue} onClick={handleSendDue} size="sm" variant="primary">{runningDue ? 'Working...' : 'Send due recovery emails'}</AdminButton>
            </>
          )}
          description={`Page ${pagination.page} of ${pagination.totalPages}`}
          eyebrow="Recovery"
          title="Abandoned checkouts"
        />

        <AdminStatsGrid>
          <AdminStatCard label="Due" value={String(stats.due)} />
          <AdminStatCard label="Recovered" value={String(stats.recovered)} />
          <AdminStatCard label="Total abandoned" value={String(pagination.total)} />
          <AdminStatCard label="Recovery emails sent" value={String(stats.emailsSent)} />
        </AdminStatsGrid>

        <AdminCard className={styles.tableCard} variant="panel">
          <AdminToolbar><span className={styles.toolbarText}>Recovery queue</span></AdminToolbar>
          {notice ? <p className={styles.notice}>{notice}</p> : null}
          {!loading && checkouts.length === 0 ? (
            <AdminEmptyState description="Recovery emails will appear here once abandoned sessions are detected." icon="mark_email_unread" title="No abandoned checkouts found" />
          ) : (
            <AdminTable
              columns={[
                { key: 'email', header: 'Email', render: row => row.email || '-' },
                { key: 'total', header: 'Total', render: row => formatMoneyFromCents(row.totalCents, row.currency) },
                { key: 'status', header: 'Status', render: row => <AdminStatusChip tone={row.recoveredAt ? 'success' : 'warning'}>{row.status}</AdminStatusChip> },
                { key: 'created', header: 'Created', render: row => formatTime(row.createdAt, settings?.timezone) },
                { key: 'abandoned', header: 'Abandoned', render: row => formatTime(row.abandonedAt, settings?.timezone) },
                { key: 'emails', header: 'Recovery Emails', render: row => row.recoveryEmailCount },
                { key: 'last', header: 'Last Sent', render: row => formatTime(row.recoveryEmailSentAt, settings?.timezone) },
                { key: 'recovered', header: 'Recovered', render: row => (row.recoveredAt ? 'Yes' : 'No') },
                {
                  key: 'action', header: 'Action', render: row => (
                    <AdminButton disabled={sendingId === row.id || !!row.recoveredAt} onClick={() => handleSendRecovery(row.id)} size="sm" variant="secondary">
                      {sendingId === row.id ? 'Sending...' : 'Send recovery'}
                    </AdminButton>
                  ),
                },
              ]}
              isLoading={loading}
              rows={checkouts}
            />
          )}
          <section className={styles.paginationRow}>
            <p className={styles.paginationText}>Page {pagination.page} of {pagination.totalPages} • {pagination.total} total</p>
            <div className={styles.paginationActions}>
              <AdminButton disabled={page <= 1 || loading} onClick={() => loadCheckouts(page - 1)} size="sm" variant="secondary">Previous</AdminButton>
              <AdminButton disabled={page >= pagination.totalPages || loading} onClick={() => loadCheckouts(page + 1)} size="sm" variant="secondary">Next</AdminButton>
            </div>
          </section>
        </AdminCard>
      </AdminPage>
    </AppShell>
  );
}

