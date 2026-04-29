import React, { useEffect, useMemo, useState } from 'react';
import styles from './SettingsWorkspace.module.css';

const AVAILABLE_EVENTS = [
  'order.created',
  'order.paid',
  'order.refunded',
  'order.return_requested',
  'order.return_updated',
  'fulfillment.created',
  'checkout.failed',
  'checkout.abandoned',
  'checkout.recovery_email_sent',
  'checkout.recovered',
  'product.created',
  'product.updated',
];

const EMPTY_FORM = {
  name: '',
  type: 'CUSTOM',
  webhookUrl: '',
  webhookSecret: '',
  clearWebhookSecret: false,
  status: 'ACTIVE',
  events: [],
  secrets: [],
};

function integrationToDraft(integration) {
  return {
    name: integration.name || '',
    type: integration.type || 'CUSTOM',
    webhookUrl: integration.webhookUrl || '',
    webhookSecret: '',
    clearWebhookSecret: false,
    status: integration.status || 'ACTIVE',
    events: (integration.events || []).map((event) => event.event),
    secrets: (integration.secrets || []).map((secret) => ({ key: secret.key, value: '' })),
  };
}

function parseApiJson(response) {
  return response.json().then((payload) => {
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Request failed');
    }
    return payload.data;
  });
}

function EventCheckboxes({ selectedEvents, onChange }) {
  function toggle(eventName) {
    onChange(
      selectedEvents.includes(eventName)
        ? selectedEvents.filter((event) => event !== eventName)
        : [...selectedEvents, eventName]
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
      {AVAILABLE_EVENTS.map((eventName) => (
        <label className={styles.checkboxField} key={eventName}>
          <input checked={selectedEvents.includes(eventName)} onChange={() => toggle(eventName)} type="checkbox" />
          <span>{eventName}</span>
        </label>
      ))}
    </div>
  );
}

function SecretRows({ secrets, onChange }) {
  function updateSecret(index, patch) {
    onChange(secrets.map((secret, entryIndex) => (entryIndex === index ? { ...secret, ...patch } : secret)));
  }

  return (
    <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
      <span>Custom headers / secrets</span>
      <p className={styles.cardSubtext}>Use keys like HEADER_X-API-Key to send encrypted custom headers with outbound deliveries. Existing values are preserved when the value field is blank.</p>
      {secrets.map((secret, index) => (
        <div key={`${secret.key}-${index}`} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input className={styles.input} value={secret.key} onChange={(event) => updateSecret(index, { key: event.target.value })} placeholder="HEADER_X-API-Key" />
          <input className={styles.input} type="password" value={secret.value} onChange={(event) => updateSecret(index, { value: event.target.value })} placeholder="Leave blank to keep existing" />
          <button className={styles.dangerButton} onClick={() => onChange(secrets.filter((_, entryIndex) => entryIndex !== index))} type="button">Remove</button>
        </div>
      ))}
      <button className={styles.textActionButton} onClick={() => onChange([...secrets, { key: '', value: '' }])} style={{ marginTop: 8 }} type="button">+ Add secret/header</button>
    </div>
  );
}

function IntegrationEditor({ integration, onSaved, onCancel }) {
  const [draft, setDraft] = useState(() => integrationToDraft(integration));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const updated = await fetch(`/api/settings/integrations/${integration.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          secrets: draft.secrets.filter((secret) => secret.key.trim()),
        }),
      }).then(parseApiJson);
      onSaved(updated);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save integration');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.configRow}>
      {error ? <p className={styles.statusTitle} style={{ color: 'red' }}>{error}</p> : null}
      <div className={styles.inlineGrid}>
        <label className={styles.field}>
          <span>Name</span>
          <input className={styles.input} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label className={styles.field}>
          <span>Type</span>
          <input className={styles.input} value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))} />
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select className={styles.input} value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Webhook URL</span>
          <input className={styles.input} value={draft.webhookUrl} onChange={(event) => setDraft((current) => ({ ...current, webhookUrl: event.target.value }))} placeholder="https://example.com/webhooks/doopify" />
        </label>
        <label className={styles.field}>
          <span>Signing secret</span>
          <input
            className={styles.input}
            disabled={draft.clearWebhookSecret}
            type="password"
            value={draft.webhookSecret}
            onChange={(event) => setDraft((current) => ({ ...current, webhookSecret: event.target.value }))}
            placeholder="Leave blank to keep existing"
          />
        </label>
        <label className={styles.checkboxField}>
          <input checked={draft.clearWebhookSecret} onChange={(event) => setDraft((current) => ({ ...current, clearWebhookSecret: event.target.checked, webhookSecret: event.target.checked ? '' : current.webhookSecret }))} type="checkbox" />
          <span>Clear existing signing secret</span>
        </label>
        <div style={{ gridColumn: '1 / -1' }}>
          <span>Subscribed events</span>
          <EventCheckboxes selectedEvents={draft.events} onChange={(events) => setDraft((current) => ({ ...current, events }))} />
        </div>
        <SecretRows secrets={draft.secrets} onChange={(secrets) => setDraft((current) => ({ ...current, secrets }))} />
      </div>
      <div className={styles.actionRow}>
        <button className={styles.secondaryButton} disabled={saving} onClick={handleSave} type="button">{saving ? 'Saving...' : 'Save integration'}</button>
        <button className={styles.textActionButton} disabled={saving} onClick={onCancel} type="button">Cancel</button>
      </div>
    </div>
  );
}

export default function IntegrationsPanel() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);

  const activeCount = useMemo(() => integrations.filter((integration) => integration.status === 'ACTIVE').length, [integrations]);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  async function fetchIntegrations() {
    setLoading(true);
    setError('');
    try {
      const data = await fetch('/api/settings/integrations').then(parseApiJson);
      setIntegrations(data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      setError('');
      const created = await fetch('/api/settings/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          secrets: draft.secrets.filter((secret) => secret.key.trim() && secret.value.trim()),
        }),
      }).then(parseApiJson);
      setIntegrations((current) => [created, ...current]);
      setDraft({ ...EMPTY_FORM });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create integration');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this integration and its queued deliveries?')) return;
    try {
      await fetch(`/api/settings/integrations/${id}`, { method: 'DELETE' }).then(parseApiJson);
      setIntegrations((current) => current.filter((integration) => integration.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete integration');
    }
  }

  function handleSaved(updated) {
    setIntegrations((current) => current.map((integration) => (integration.id === updated.id ? updated : integration)));
    setEditingId(null);
  }

  if (loading) return <p className={styles.statusText}>Loading integrations...</p>;

  return (
    <div className={styles.configStack}>
      {error ? <p className={styles.statusTitle} style={{ color: 'red' }}>{error}</p> : null}

      <section className={styles.configSection}>
        <div className={styles.sectionHeading}>
          <h3>Webhook subscriptions</h3>
          <p className={styles.cardSubtext}>{integrations.length} configured, {activeCount} active.</p>
        </div>
        <p className={styles.cardSubtext}>Outbound webhooks are queued from typed internal events and delivered with timestamped HMAC signatures when a signing secret is set.</p>
      </section>

      <section className={styles.configSection}>
        <div className={styles.sectionHeading}>
          <h3>Add integration</h3>
        </div>
        <div className={styles.inlineGrid}>
          <label className={styles.field}>
            <span>Name</span>
            <input className={styles.input} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>Type</span>
            <input className={styles.input} value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))} />
          </label>
          <label className={styles.field}>
            <span>Status</span>
            <select className={styles.input} value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Webhook URL</span>
            <input className={styles.input} value={draft.webhookUrl} onChange={(event) => setDraft((current) => ({ ...current, webhookUrl: event.target.value }))} placeholder="https://example.com/webhooks/doopify" />
          </label>
          <label className={styles.field}>
            <span>Signing secret</span>
            <input className={styles.input} type="password" value={draft.webhookSecret} onChange={(event) => setDraft((current) => ({ ...current, webhookSecret: event.target.value }))} placeholder="Encrypted at rest" />
          </label>
          <div style={{ gridColumn: '1 / -1' }}>
            <span>Subscribed events</span>
            <EventCheckboxes selectedEvents={draft.events} onChange={(events) => setDraft((current) => ({ ...current, events }))} />
          </div>
          <SecretRows secrets={draft.secrets} onChange={(secrets) => setDraft((current) => ({ ...current, secrets }))} />
          <button className={styles.secondaryButton} onClick={handleCreate} style={{ gridColumn: '1 / -1', marginTop: 16 }} type="button">
            Add integration
          </button>
        </div>
      </section>

      <section className={styles.configSection}>
        <div className={styles.sectionHeading}>
          <h3>Configured integrations</h3>
        </div>
        {integrations.length === 0 && <p className={styles.cardSubtext}>No integrations configured.</p>}
        {integrations.map((integration) => (
          editingId === integration.id ? (
            <IntegrationEditor
              integration={integration}
              key={integration.id}
              onCancel={() => setEditingId(null)}
              onSaved={handleSaved}
            />
          ) : (
            <div className={styles.configRow} key={integration.id}>
              <div className={styles.inlineGrid}>
                <label className={styles.field}>
                  <span>Name</span>
                  <input className={styles.input} value={integration.name} disabled />
                </label>
                <label className={styles.field}>
                  <span>Status</span>
                  <input className={styles.input} value={integration.status} disabled />
                </label>
                <label className={styles.field}>
                  <span>Webhook URL</span>
                  <input className={styles.input} value={integration.webhookUrl || ''} disabled />
                </label>
              </div>
              <div style={{ padding: '0 16px' }}>
                <p style={{ fontSize: '0.85rem', color: '#666' }}>Events: {(integration.events || []).map((event) => event.event).join(', ') || 'None'}</p>
                <p style={{ fontSize: '0.85rem', color: '#666' }}>Stored secrets/headers: {(integration.secrets || []).map((secret) => secret.key).join(', ') || 'None'}</p>
              </div>
              <div className={styles.actionRow}>
                <button className={styles.secondaryButton} onClick={() => setEditingId(integration.id)} type="button">Edit</button>
                <button className={styles.dangerButton} onClick={() => handleDelete(integration.id)} type="button">Delete</button>
              </div>
            </div>
          )
        ))}
      </section>
    </div>
  );
}
