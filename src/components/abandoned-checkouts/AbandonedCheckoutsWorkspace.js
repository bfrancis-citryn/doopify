"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import AppShell from '@/components/AppShell';

function formatMoneyFromCents(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format((Number(cents) || 0) / 100)
}

function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export default function AbandonedCheckoutsWorkspace() {
  const [loading, setLoading] = useState(true)
  const [checkouts, setCheckouts] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
  const [notice, setNotice] = useState('')
  const [sendingId, setSendingId] = useState(null)
  const [runningDue, setRunningDue] = useState(false)

  const loadCheckouts = useCallback(async (nextPage = page) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/abandoned-checkouts?page=${nextPage}&pageSize=20`, {
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load abandoned checkouts')
      }

      setCheckouts(payload.data?.checkouts ?? [])
      setPagination(payload.data?.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 })
      setPage(nextPage)
      setNotice('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to load abandoned checkouts')
      setCheckouts([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void loadCheckouts(1)
  }, [loadCheckouts])

  const stats = useMemo(() => {
    const recovered = checkouts.filter((checkout) => !!checkout.recoveredAt).length
    const due = checkouts.filter((checkout) => !checkout.recoveredAt).length
    return { recovered, due }
  }, [checkouts])

  async function handleSendRecovery(id) {
    if (!id) return
    setSendingId(id)
    setNotice('')
    try {
      const response = await fetch(`/api/abandoned-checkouts/${id}/send-recovery`, {
        method: 'POST',
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Recovery email send failed')
      }

      setNotice('Recovery email sent.')
      await loadCheckouts(page)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Recovery email send failed')
    } finally {
      setSendingId(null)
    }
  }

  async function handleSendDue() {
    setRunningDue(true)
    setNotice('')
    try {
      const response = await fetch('/api/abandoned-checkouts/send-due?limit=50', {
        method: 'POST',
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Due recovery processing failed')
      }

      const summary = payload.data
      setNotice(
        `Due run complete. Marked ${summary.markedAbandoned}, attempted ${summary.emailsAttempted}, sent ${summary.emailsSent}, failed ${summary.emailsFailed}, skipped ${summary.skipped}.`
      )
      await loadCheckouts(page)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Due recovery processing failed')
    } finally {
      setRunningDue(false)
    }
  }

  async function handleMarkDue() {
    setRunningDue(true)
    setNotice('')
    try {
      const response = await fetch('/api/abandoned-checkouts/mark-due', {
        method: 'POST',
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to mark abandoned checkouts')
      }

      setNotice(`Marked ${payload.data?.markedAbandoned ?? 0} checkouts as abandoned.`)
      await loadCheckouts(page)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to mark abandoned checkouts')
    } finally {
      setRunningDue(false)
    }
  }

  return (
    <AppShell searchPlaceholder="Search not yet enabled">
      <div style={{ display: 'grid', gap: 18 }}>
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 18, background: '#fff' }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>Abandoned checkouts</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            Due: {stats.due} • Recovered: {stats.recovered}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button disabled={runningDue} onClick={handleMarkDue} type="button">
              {runningDue ? 'Working…' : 'Mark due abandoned'}
            </button>
            <button disabled={runningDue} onClick={handleSendDue} type="button">
              {runningDue ? 'Working…' : 'Send due recovery emails'}
            </button>
          </div>
          {notice ? <p style={{ marginTop: 12, color: '#374151' }}>{notice}</p> : null}
        </section>

        <section style={{ border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: 12 }}>Email</th>
                <th style={{ padding: 12 }}>Total</th>
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Created</th>
                <th style={{ padding: 12 }}>Abandoned</th>
                <th style={{ padding: 12 }}>Recovery emails</th>
                <th style={{ padding: 12 }}>Last sent</th>
                <th style={{ padding: 12 }}>Recovered</th>
                <th style={{ padding: 12 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 16 }}>Loading abandoned checkouts…</td>
                </tr>
              ) : checkouts.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 16 }}>No abandoned checkouts found.</td>
                </tr>
              ) : (
                checkouts.map((checkout) => (
                  <tr key={checkout.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 12 }}>{checkout.email || '—'}</td>
                    <td style={{ padding: 12 }}>
                      {formatMoneyFromCents(checkout.totalCents, checkout.currency)}
                    </td>
                    <td style={{ padding: 12 }}>{checkout.status}</td>
                    <td style={{ padding: 12 }}>{formatTime(checkout.createdAt)}</td>
                    <td style={{ padding: 12 }}>{formatTime(checkout.abandonedAt)}</td>
                    <td style={{ padding: 12 }}>{checkout.recoveryEmailCount}</td>
                    <td style={{ padding: 12 }}>{formatTime(checkout.recoveryEmailSentAt)}</td>
                    <td style={{ padding: 12 }}>{checkout.recoveredAt ? 'Yes' : 'No'}</td>
                    <td style={{ padding: 12 }}>
                      <button
                        disabled={sendingId === checkout.id || !!checkout.recoveredAt}
                        onClick={() => handleSendRecovery(checkout.id)}
                        type="button"
                      >
                        {sendingId === checkout.id ? 'Sending…' : 'Send recovery'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Page {pagination.page} of {pagination.totalPages} • {pagination.total} total
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={page <= 1 || loading} onClick={() => loadCheckouts(page - 1)} type="button">Previous</button>
            <button disabled={page >= pagination.totalPages || loading} onClick={() => loadCheckouts(page + 1)} type="button">Next</button>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
