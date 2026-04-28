import React, { useState, useEffect } from 'react';
import styles from './SettingsWorkspace.module.css';

const EMPTY_FORM = {
  name: '',
  type: 'CUSTOM',
  webhookUrl: '',
  webhookSecret: '',
  status: 'ACTIVE',
  events: '',
  secrets: []
};

export default function IntegrationsPanel() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    fetchIntegrations();
  }, []);

  async function fetchIntegrations() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/integrations');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setIntegrations(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      setError('');
      const evts = draft.events ? draft.events.split(',').map(e => e.trim()).filter(Boolean) : [];
      const res = await fetch('/api/settings/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          events: evts,
          secrets: draft.secrets
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setIntegrations(prev => [json.data, ...prev]);
      setDraft({ ...EMPTY_FORM });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure?')) return;
    try {
      const res = await fetch(`/api/settings/integrations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setIntegrations(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className={styles.statusText}>Loading integrations...</p>;

  return (
    <div className={styles.configStack}>
      {error && <p className={styles.statusTitle} style={{color:'red'}}>{error}</p>}
      
      <section className={styles.configSection}>
        <div className={styles.sectionHeading}>
          <h3>Add New Integration</h3>
        </div>
        <div className={styles.inlineGrid}>
          <label className={styles.field}>
            <span>Name</span>
            <input className={styles.input} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>Type</span>
            <input className={styles.input} value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>Webhook URL</span>
            <input className={styles.input} value={draft.webhookUrl} onChange={e => setDraft(d => ({ ...d, webhookUrl: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>Webhook Secret</span>
            <input className={styles.input} value={draft.webhookSecret} onChange={e => setDraft(d => ({ ...d, webhookSecret: e.target.value }))} placeholder="Will be encrypted" />
          </label>
          <label className={styles.field} style={{ gridColumn: '1 / -1' }}>
            <span>Subscribed Events (comma separated)</span>
            <input className={styles.input} value={draft.events} onChange={e => setDraft(d => ({ ...d, events: e.target.value }))} placeholder="order.paid, fulfillment.created" />
          </label>
          <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
            <span>Secrets</span>
            {draft.secrets.map((sec, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <input className={styles.input} value={sec.key} onChange={e => {
                  const s = [...draft.secrets]; s[i].key = e.target.value; setDraft(d => ({...d, secrets: s}));
                }} placeholder="Key" />
                <input className={styles.input} type="password" value={sec.value} onChange={e => {
                  const s = [...draft.secrets]; s[i].value = e.target.value; setDraft(d => ({...d, secrets: s}));
                }} placeholder="Value" />
                <button type="button" onClick={() => {
                  const s = draft.secrets.filter((_, idx) => idx !== i); setDraft(d => ({...d, secrets: s}));
                }} className={styles.dangerButton}>X</button>
              </div>
            ))}
            <button type="button" onClick={() => setDraft(d => ({ ...d, secrets: [...d.secrets, { key: '', value: '' }] }))} className={styles.textActionButton} style={{marginTop:8}}>+ Add Secret</button>
          </div>
          <button className={styles.secondaryButton} onClick={handleCreate} type="button" style={{ gridColumn: '1 / -1', marginTop: 16 }}>
            Add Integration
          </button>
        </div>
      </section>

      <section className={styles.configSection}>
        <div className={styles.sectionHeading}>
          <h3>Active Integrations</h3>
        </div>
        {integrations.length === 0 && <p className={styles.cardSubtext}>No integrations configured.</p>}
        {integrations.map(int => (
          <div className={styles.configRow} key={int.id}>
            <div className={styles.inlineGrid}>
              <label className={styles.field}>
                <span>Name</span>
                <input className={styles.input} value={int.name} disabled />
              </label>
              <label className={styles.field}>
                <span>Webhook URL</span>
                <input className={styles.input} value={int.webhookUrl || ''} disabled />
              </label>
            </div>
            <div style={{ padding: '0 16px' }}>
              <p style={{fontSize:'0.85rem', color: '#666'}}>Events: {int.events.map(e => e.event).join(', ') || 'None'}</p>
              <p style={{fontSize:'0.85rem', color: '#666'}}>Stored Secrets: {int.secrets.map(s => s.key).join(', ') || 'None'}</p>
            </div>
            <div className={styles.actionRow}>
               <button className={styles.dangerButton} onClick={() => handleDelete(int.id)} type="button">Delete</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
