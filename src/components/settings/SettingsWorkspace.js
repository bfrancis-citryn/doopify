"use client";

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../AppShell';
import { useSettings } from '../../context/SettingsContext';
import styles from './SettingsWorkspace.module.css';
import IntegrationsPanel from './IntegrationsPanel';

const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'branding', label: 'Branding' },
  { id: 'locations', label: 'Locations' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'payments', label: 'Payments' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'users', label: 'Users & permissions' },
  { id: 'setup', label: 'Setup' },
  { id: 'integrations', label: 'Integrations & Webhooks' },
];

const SETUP_STATUS_PRIORITY = {
  PASS: 0,
  WARN: 1,
  FAIL: 2,
};

const SETUP_CARD_DEFINITIONS = [
  { id: 'database', label: 'Database connected', checkIds: ['database-url', 'database-reachable', 'prisma-client-generated'] },
  { id: 'admin', label: 'Admin account created', checkIds: ['owner-user-exists'] },
  { id: 'store', label: 'Store profile complete', checkIds: ['store-exists', 'store-settings'] },
  { id: 'stripe-core', label: 'Stripe configured', checkIds: ['stripe-keys'] },
  { id: 'stripe-webhook', label: 'Stripe webhook configured', checkIds: ['stripe-webhook-secret'] },
  { id: 'email-provider', label: 'Email provider configured', checkIds: ['resend-api-or-preview'] },
  { id: 'email-webhook', label: 'Email webhook configured', checkIds: ['resend-webhook-secret-enabled'] },
  { id: 'webhook-retry', label: 'Webhook retry secret configured', checkIds: ['webhook-retry-secret'] },
  { id: 'public-url', label: 'Public app URL configured', checkIds: ['next-public-store-url'] },
  { id: 'deployment', label: 'Deployment ready', checkIds: ['vercel-deployment'] },
];

const SETUP_COMMANDS = [
  {
    id: 'doctor',
    label: 'Run doctor',
    command: 'npm run doopify:doctor',
  },
  {
    id: 'db-check',
    label: 'Check Neon/DB',
    command: 'npm run doopify:db:check',
  },
  {
    id: 'setup',
    label: 'Run guided setup',
    command: 'npm run doopify:setup',
  },
  {
    id: 'stripe-webhook',
    label: 'Configure webhooks',
    command: 'npm run doopify:stripe:webhook',
  },
  {
    id: 'env-push',
    label: 'Push Vercel env',
    command: 'npm run doopify:env:push',
  },
  {
    id: 'deploy',
    label: 'Deploy production',
    command: 'npm run doopify:deploy',
  },
];

const PROVIDER_HINTS = [
  'Stripe: set STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET.',
  'Resend: set RESEND_API_KEY for live sends. Leave unset for preview mode.',
  'Email webhooks: set RESEND_WEBHOOK_SECRET before enabling provider webhook delivery.',
  'Deployment: set NEXT_PUBLIC_STORE_URL and configure VERCEL_URL/VERCEL_ENV for hosted environments.',
];

const EMPTY_ZONE_FORM = {
  name: '',
  countryCode: '',
  provinceCode: '',
  priority: '100',
  isActive: true,
};

const EMPTY_RATE_FORM = {
  name: '',
  method: 'FLAT',
  amount: '',
  minSubtotal: '',
  maxSubtotal: '',
  priority: '100',
  isActive: true,
};

const EMPTY_TAX_FORM = {
  name: '',
  countryCode: '',
  provinceCode: '',
  ratePercent: '',
  priority: '100',
  isActive: true,
};

function parseNumberOrUndefined(value) {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNumberOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toZoneForm(zone) {
  return {
    id: zone.id,
    name: zone.name || '',
    countryCode: zone.countryCode || '',
    provinceCode: zone.provinceCode || '',
    priority: String(zone.priority ?? 100),
    isActive: zone.isActive !== false,
    rates: (zone.rates || []).map((rate) => ({
      id: rate.id,
      name: rate.name || '',
      method: rate.method || 'FLAT',
      amount: String(rate.amount ?? ''),
      minSubtotal: rate.minSubtotal == null ? '' : String(rate.minSubtotal),
      maxSubtotal: rate.maxSubtotal == null ? '' : String(rate.maxSubtotal),
      priority: String(rate.priority ?? 100),
      isActive: rate.isActive !== false,
    })),
  };
}

function toTaxForm(rule) {
  return {
    id: rule.id,
    name: rule.name || '',
    countryCode: rule.countryCode || '',
    provinceCode: rule.provinceCode || '',
    ratePercent: String(Number(rule.rate ?? 0) * 100),
    priority: String(rule.priority ?? 100),
    isActive: rule.isActive !== false,
  };
}

async function parseApiJson(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Request failed');
  }
  return payload.data;
}

function getHigherStatus(left, right) {
  if (!left) return right || 'PASS';
  if (!right) return left;
  return SETUP_STATUS_PRIORITY[right] > SETUP_STATUS_PRIORITY[left] ? right : left;
}

function normalizeCheckStatus(check) {
  if (!check) return 'WARN';
  if (check.status === 'FAIL' && !check.required) return 'WARN';
  return check.status || 'WARN';
}

function extractEnvVariableHints(checks) {
  const envNames = new Set();
  const envPattern = /\b[A-Z][A-Z0-9_]{2,}\b/g;

  for (const check of checks || []) {
    const scanTarget = `${check.summary || ''} ${check.fix || ''}`;
    const matches = scanTarget.match(envPattern) || [];
    for (const match of matches) {
      if (match.startsWith('API') || match === 'HTTP' || match === 'HTTPS') continue;
      envNames.add(match);
    }
  }

  return Array.from(envNames).slice(0, 12);
}

export default function SettingsWorkspace() {
  const [activeSection, setActiveSection] = useState('general');
  const { settings, updateSettings, loading, error } = useSettings();
  const [shippingConfigLoading, setShippingConfigLoading] = useState(false);
  const [shippingConfigError, setShippingConfigError] = useState('');
  const [shippingConfigLoaded, setShippingConfigLoaded] = useState(false);
  const [shippingZones, setShippingZones] = useState([]);
  const [taxRules, setTaxRules] = useState([]);
  const [newZone, setNewZone] = useState(EMPTY_ZONE_FORM);
  const [newTaxRule, setNewTaxRule] = useState(EMPTY_TAX_FORM);
  const [newRateByZoneId, setNewRateByZoneId] = useState({});
  const [setupStatus, setSetupStatus] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupCopiedCommandId, setSetupCopiedCommandId] = useState('');

  const activeTitle = useMemo(
    () => SETTINGS_SECTIONS.find((section) => section.id === activeSection)?.label || 'Settings',
    [activeSection]
  );

  useEffect(() => {
    if (activeSection !== 'shipping' || shippingConfigLoaded || shippingConfigLoading) {
      return;
    }

    let cancelled = false;

    async function loadShippingConfig() {
      setShippingConfigLoading(true);
      setShippingConfigError('');
      try {
        const [zonesData, taxRulesData] = await Promise.all([
          fetch('/api/settings/shipping-zones').then(parseApiJson),
          fetch('/api/settings/tax-rules').then(parseApiJson),
        ]);

        if (cancelled) return;
        setShippingZones((zonesData || []).map(toZoneForm));
        setTaxRules((taxRulesData || []).map(toTaxForm));
        setShippingConfigLoaded(true);
      } catch (loadError) {
        if (cancelled) return;
        setShippingConfigError(loadError instanceof Error ? loadError.message : 'Failed to load shipping configuration');
      } finally {
        if (!cancelled) {
          setShippingConfigLoading(false);
        }
      }
    }

    loadShippingConfig();

    return () => {
      cancelled = true;
    };
  }, [activeSection, shippingConfigLoaded, shippingConfigLoading]);

  useEffect(() => {
    if (activeSection !== 'setup' || setupLoading || setupStatus) {
      return;
    }

    let cancelled = false;

    async function loadSetupStatus() {
      setSetupLoading(true);
      setSetupError('');

      try {
        const diagnostics = await fetch('/api/setup/status').then(parseApiJson);
        if (!cancelled) {
          setSetupStatus(diagnostics);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSetupError(loadError instanceof Error ? loadError.message : 'Failed to load setup diagnostics');
        }
      } finally {
        if (!cancelled) {
          setSetupLoading(false);
        }
      }
    }

    loadSetupStatus();

    return () => {
      cancelled = true;
    };
  }, [activeSection, setupStatus, setupLoading]);

  const setupChecks = useMemo(() => {
    if (!setupStatus) return [];
    return [...(setupStatus.requiredChecks || []), ...(setupStatus.recommendedChecks || [])];
  }, [setupStatus]);

  const setupCheckById = useMemo(() => {
    const byId = {};
    for (const check of setupChecks) {
      byId[check.id] = check;
    }
    return byId;
  }, [setupChecks]);

  const setupCards = useMemo(() => {
    return SETUP_CARD_DEFINITIONS.map((card) => {
      const checks = card.checkIds.map((id) => setupCheckById[id]).filter(Boolean);
      let status = 'WARN';
      let fix = '';
      let summary = 'Pending check data.';

      if (checks.length > 0) {
        status = checks.reduce((current, check) => getHigherStatus(current, normalizeCheckStatus(check)), 'PASS');
        const primaryIssue = checks.find((check) => normalizeCheckStatus(check) !== 'PASS');
        summary = primaryIssue?.summary || checks[0].summary || 'Configured.';
        fix = primaryIssue?.fix || '';
      }

      return {
        ...card,
        status,
        summary,
        fix,
      };
    });
  }, [setupCheckById]);

  const setupMissingEnvVars = useMemo(() => extractEnvVariableHints(setupChecks), [setupChecks]);

  async function refreshShippingConfig() {
    setShippingConfigLoaded(false);
    setShippingConfigLoading(false);
    setShippingConfigError('');
    const [zonesData, taxRulesData] = await Promise.all([
      fetch('/api/settings/shipping-zones').then(parseApiJson),
      fetch('/api/settings/tax-rules').then(parseApiJson),
    ]);
    setShippingZones((zonesData || []).map(toZoneForm));
    setTaxRules((taxRulesData || []).map(toTaxForm));
    setShippingConfigLoaded(true);
  }

  async function refreshSetupStatus() {
    try {
      setSetupLoading(true);
      setSetupError('');
      const diagnostics = await fetch('/api/setup/status').then(parseApiJson);
      setSetupStatus(diagnostics);
    } catch (refreshError) {
      setSetupError(refreshError instanceof Error ? refreshError.message : 'Failed to refresh setup diagnostics');
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleCopyCommand(commandId, command) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(command);
      } else {
        const temp = document.createElement('textarea');
        temp.value = command;
        temp.setAttribute('readonly', '');
        temp.style.position = 'absolute';
        temp.style.left = '-9999px';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }

      setSetupCopiedCommandId(commandId);
      setTimeout(() => {
        setSetupCopiedCommandId((current) => (current === commandId ? '' : current));
      }, 1400);
    } catch {
      setSetupCopiedCommandId('');
    }
  }

  async function handleCreateZone() {
    try {
      setShippingConfigError('');
      const created = await fetch('/api/settings/shipping-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newZone.name,
          countryCode: newZone.countryCode,
          provinceCode: newZone.provinceCode || null,
          priority: parseNumberOrUndefined(newZone.priority),
          isActive: newZone.isActive,
        }),
      }).then(parseApiJson);

      setShippingZones((current) => [...current, toZoneForm(created)]);
      setNewZone(EMPTY_ZONE_FORM);
    } catch (createError) {
      setShippingConfigError(createError instanceof Error ? createError.message : 'Failed to create shipping zone');
    }
  }

  function updateZoneDraft(zoneId, patch) {
    setShippingZones((current) =>
      current.map((zone) =>
        zone.id === zoneId
          ? {
              ...zone,
              ...patch,
            }
          : zone
      )
    );
  }

  async function handleSaveZone(zone) {
    try {
      setShippingConfigError('');
      const updated = await fetch(`/api/settings/shipping-zones/${zone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: zone.name,
          countryCode: zone.countryCode,
          provinceCode: zone.provinceCode || null,
          priority: parseNumberOrUndefined(zone.priority),
          isActive: zone.isActive,
        }),
      }).then(parseApiJson);

      setShippingZones((current) => current.map((entry) => (entry.id === zone.id ? toZoneForm(updated) : entry)));
    } catch (saveError) {
      setShippingConfigError(saveError instanceof Error ? saveError.message : 'Failed to save shipping zone');
    }
  }

  async function handleDeleteZone(zoneId) {
    try {
      setShippingConfigError('');
      await fetch(`/api/settings/shipping-zones/${zoneId}`, {
        method: 'DELETE',
      }).then(parseApiJson);
      setShippingZones((current) => current.filter((zone) => zone.id !== zoneId));
      setNewRateByZoneId((current) => {
        const next = { ...current };
        delete next[zoneId];
        return next;
      });
    } catch (deleteError) {
      setShippingConfigError(deleteError instanceof Error ? deleteError.message : 'Failed to delete shipping zone');
    }
  }

  function updateRateDraft(zoneId, rateId, patch) {
    setShippingZones((current) =>
      current.map((zone) =>
        zone.id === zoneId
          ? {
              ...zone,
              rates: zone.rates.map((rate) => (rate.id === rateId ? { ...rate, ...patch } : rate)),
            }
          : zone
      )
    );
  }

  async function handleSaveRate(zoneId, rate) {
    try {
      setShippingConfigError('');
      const updated = await fetch(`/api/settings/shipping-zones/${zoneId}/rates/${rate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rate.name,
          method: rate.method,
          amount: parseNumberOrUndefined(rate.amount),
          minSubtotal: parseNumberOrNull(rate.minSubtotal),
          maxSubtotal: parseNumberOrNull(rate.maxSubtotal),
          priority: parseNumberOrUndefined(rate.priority),
          isActive: rate.isActive,
        }),
      }).then(parseApiJson);

      updateRateDraft(zoneId, rate.id, {
        name: updated.name,
        method: updated.method,
        amount: String(updated.amount ?? ''),
        minSubtotal: updated.minSubtotal == null ? '' : String(updated.minSubtotal),
        maxSubtotal: updated.maxSubtotal == null ? '' : String(updated.maxSubtotal),
        priority: String(updated.priority ?? 100),
        isActive: updated.isActive !== false,
      });
    } catch (saveError) {
      setShippingConfigError(saveError instanceof Error ? saveError.message : 'Failed to save shipping rate');
    }
  }

  async function handleDeleteRate(zoneId, rateId) {
    try {
      setShippingConfigError('');
      await fetch(`/api/settings/shipping-zones/${zoneId}/rates/${rateId}`, {
        method: 'DELETE',
      }).then(parseApiJson);

      setShippingZones((current) =>
        current.map((zone) =>
          zone.id === zoneId
            ? {
                ...zone,
                rates: zone.rates.filter((rate) => rate.id !== rateId),
              }
            : zone
        )
      );
    } catch (deleteError) {
      setShippingConfigError(deleteError instanceof Error ? deleteError.message : 'Failed to delete shipping rate');
    }
  }

  async function handleCreateRate(zoneId) {
    const draft = newRateByZoneId[zoneId] || EMPTY_RATE_FORM;

    try {
      setShippingConfigError('');
      const created = await fetch(`/api/settings/shipping-zones/${zoneId}/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          method: draft.method,
          amount: parseNumberOrUndefined(draft.amount),
          minSubtotal: parseNumberOrNull(draft.minSubtotal),
          maxSubtotal: parseNumberOrNull(draft.maxSubtotal),
          priority: parseNumberOrUndefined(draft.priority),
          isActive: draft.isActive,
        }),
      }).then(parseApiJson);

      setShippingZones((current) =>
        current.map((zone) =>
          zone.id === zoneId
            ? {
                ...zone,
                rates: [
                  ...zone.rates,
                  {
                    id: created.id,
                    name: created.name,
                    method: created.method,
                    amount: String(created.amount ?? ''),
                    minSubtotal: created.minSubtotal == null ? '' : String(created.minSubtotal),
                    maxSubtotal: created.maxSubtotal == null ? '' : String(created.maxSubtotal),
                    priority: String(created.priority ?? 100),
                    isActive: created.isActive !== false,
                  },
                ],
              }
            : zone
        )
      );

      setNewRateByZoneId((current) => ({
        ...current,
        [zoneId]: { ...EMPTY_RATE_FORM },
      }));
    } catch (createError) {
      setShippingConfigError(createError instanceof Error ? createError.message : 'Failed to create shipping rate');
    }
  }

  async function handleCreateTaxRule() {
    try {
      setShippingConfigError('');
      const created = await fetch('/api/settings/tax-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTaxRule.name,
          countryCode: newTaxRule.countryCode,
          provinceCode: newTaxRule.provinceCode || null,
          rate: (parseNumberOrUndefined(newTaxRule.ratePercent) ?? 0) / 100,
          priority: parseNumberOrUndefined(newTaxRule.priority),
          isActive: newTaxRule.isActive,
        }),
      }).then(parseApiJson);

      setTaxRules((current) => [...current, toTaxForm(created)]);
      setNewTaxRule(EMPTY_TAX_FORM);
    } catch (createError) {
      setShippingConfigError(createError instanceof Error ? createError.message : 'Failed to create tax rule');
    }
  }

  function updateTaxRuleDraft(ruleId, patch) {
    setTaxRules((current) => current.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)));
  }

  async function handleSaveTaxRule(rule) {
    try {
      setShippingConfigError('');
      const updated = await fetch(`/api/settings/tax-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rule.name,
          countryCode: rule.countryCode,
          provinceCode: rule.provinceCode || null,
          rate: (parseNumberOrUndefined(rule.ratePercent) ?? 0) / 100,
          priority: parseNumberOrUndefined(rule.priority),
          isActive: rule.isActive,
        }),
      }).then(parseApiJson);

      setTaxRules((current) => current.map((entry) => (entry.id === rule.id ? toTaxForm(updated) : entry)));
    } catch (saveError) {
      setShippingConfigError(saveError instanceof Error ? saveError.message : 'Failed to save tax rule');
    }
  }

  async function handleDeleteTaxRule(ruleId) {
    try {
      setShippingConfigError('');
      await fetch(`/api/settings/tax-rules/${ruleId}`, {
        method: 'DELETE',
      }).then(parseApiJson);
      setTaxRules((current) => current.filter((rule) => rule.id !== ruleId));
    } catch (deleteError) {
      setShippingConfigError(deleteError instanceof Error ? deleteError.message : 'Failed to delete tax rule');
    }
  }

  return (
    <AppShell
      onCreateOrder={() => {}}
      onNotificationsClick={() => {}}
      onQuickActionClick={() => {}}
      onSearchChange={() => {}}
      searchValue=""
    >
      <div className={styles.page}>
        <div className={styles.navPanel}>
          <div className={styles.navHeader}>
            <p className={styles.eyebrow}>Settings</p>
            <h2 className={styles.title}>Store configuration</h2>
          </div>
          <div className={styles.sectionList}>
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                className={activeSection === section.id ? styles.sectionButtonActive : styles.sectionButton}
                disabled={loading}
                onClick={() => setActiveSection(section.id)}
                type="button"
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.detailPanel}>
          <div aria-busy={loading || shippingConfigLoading || setupLoading} className={styles.detailCard}>
            <div className={styles.detailHeader}>
              <div>
                <p className={styles.eyebrow}>Settings</p>
                <h2 className={styles.title}>{activeTitle}</h2>
              </div>
              {activeSection === 'setup' ? (
                <button className={styles.saveButton} disabled={setupLoading} onClick={() => refreshSetupStatus()} type="button">
                  {setupLoading ? 'Refreshing...' : 'Refresh diagnostics'}
                </button>
              ) : (
                <button className={styles.saveButton} disabled={loading || Boolean(error)} type="button">
                  Save
                </button>
              )}
            </div>

            {loading ? (
              <div className={styles.statusBlock}>
                <div className={styles.loadingLine} />
                <div className={styles.loadingLine} />
                <div className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
                <p className={styles.statusText}>Loading store settings...</p>
              </div>
            ) : null}

            {!loading && error ? (
              <div className={styles.statusBlock}>
                <p className={styles.statusTitle}>Settings could not be loaded.</p>
                <p className={styles.statusText}>{error}</p>
              </div>
            ) : null}

            {!loading && !error && activeSection === 'general' ? (
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Store name</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ storeName: event.target.value })} value={settings.storeName} />
                </label>
                <label className={styles.field}>
                  <span>Support email</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ supportEmail: event.target.value })} value={settings.supportEmail} />
                </label>
                <label className={styles.field}>
                  <span>Phone</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ phone: event.target.value })} value={settings.phone} />
                </label>
                <label className={styles.field}>
                  <span>Address</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ address: event.target.value })} value={settings.address} />
                </label>
                <label className={styles.field}>
                  <span>Timezone</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ timezone: event.target.value })} value={settings.timezone} />
                </label>
                <label className={styles.field}>
                  <span>Currency</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ currency: event.target.value })} value={settings.currency} />
                </label>
              </div>
            ) : null}

            {!loading && !error && activeSection === 'branding' ? (
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Logo URL</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ logoUrl: event.target.value })} value={settings.logoUrl} />
                </label>
                <label className={styles.field}>
                  <span>Primary brand color</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ brandPrimary: event.target.value })} value={settings.brandPrimary} />
                </label>
                <label className={styles.field}>
                  <span>Accent color</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ brandAccent: event.target.value })} value={settings.brandAccent} />
                </label>
                <label className={styles.field}>
                  <span>Order prefix</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ orderPrefix: event.target.value })} value={settings.orderPrefix} />
                </label>
              </div>
            ) : null}

            {!loading && !error && activeSection === 'locations' ? (
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Default location</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ defaultLocation: event.target.value })} value={settings.defaultLocation} />
                </label>
                <label className={styles.field}>
                  <span>Shipping origin</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ shippingOrigin: event.target.value })} value={settings.shippingOrigin} />
                </label>
              </div>
            ) : null}

            {!loading && !error && activeSection === 'shipping' ? (
              <div className={styles.configStack}>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Free shipping threshold</span>
                    <input className={styles.input} onChange={(event) => updateSettings({ freeShippingThreshold: event.target.value })} value={settings.freeShippingThreshold} />
                  </label>
                  <label className={styles.field}>
                    <span>Domestic shipping rate</span>
                    <input className={styles.input} onChange={(event) => updateSettings({ domesticShippingRate: event.target.value })} value={settings.domesticShippingRate} />
                  </label>
                  <label className={styles.field}>
                    <span>International shipping rate</span>
                    <input className={styles.input} onChange={(event) => updateSettings({ internationalShippingRate: event.target.value })} value={settings.internationalShippingRate} />
                  </label>
                  <label className={styles.field}>
                    <span>Domestic tax rate (%)</span>
                    <input className={styles.input} onChange={(event) => updateSettings({ domesticTaxRate: event.target.value })} value={settings.domesticTaxRate} />
                  </label>
                  <label className={styles.field}>
                    <span>International tax rate (%)</span>
                    <input className={styles.input} onChange={(event) => updateSettings({ internationalTaxRate: event.target.value })} value={settings.internationalTaxRate} />
                  </label>
                </div>

                {shippingConfigLoading ? (
                  <p className={styles.statusText}>Loading shipping zones and tax rules...</p>
                ) : null}

                {shippingConfigError ? (
                  <div className={styles.statusBlock}>
                    <p className={styles.statusTitle}>Shipping configuration error</p>
                    <p className={styles.statusText}>{shippingConfigError}</p>
                    <button className={styles.secondaryButton} onClick={() => refreshShippingConfig()} type="button">
                      Retry
                    </button>
                  </div>
                ) : null}

                <section className={styles.configSection}>
                  <div className={styles.sectionHeading}>
                    <h3>Shipping zones</h3>
                  </div>

                  <div className={styles.inlineGrid}>
                    <label className={styles.field}>
                      <span>Zone name</span>
                      <input className={styles.input} onChange={(event) => setNewZone((current) => ({ ...current, name: event.target.value }))} value={newZone.name} />
                    </label>
                    <label className={styles.field}>
                      <span>Country code</span>
                      <input className={styles.input} onChange={(event) => setNewZone((current) => ({ ...current, countryCode: event.target.value }))} value={newZone.countryCode} />
                    </label>
                    <label className={styles.field}>
                      <span>Province code</span>
                      <input className={styles.input} onChange={(event) => setNewZone((current) => ({ ...current, provinceCode: event.target.value }))} value={newZone.provinceCode} />
                    </label>
                    <label className={styles.field}>
                      <span>Priority</span>
                      <input className={styles.input} onChange={(event) => setNewZone((current) => ({ ...current, priority: event.target.value }))} value={newZone.priority} />
                    </label>
                    <label className={styles.checkboxField}>
                      <input checked={newZone.isActive} onChange={(event) => setNewZone((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" />
                      <span>Active</span>
                    </label>
                    <button className={styles.secondaryButton} onClick={handleCreateZone} type="button">
                      Add zone
                    </button>
                  </div>

                  {shippingZones.map((zone) => (
                    <div className={styles.configRow} key={zone.id}>
                      <div className={styles.inlineGrid}>
                        <label className={styles.field}>
                          <span>Name</span>
                          <input className={styles.input} onChange={(event) => updateZoneDraft(zone.id, { name: event.target.value })} value={zone.name} />
                        </label>
                        <label className={styles.field}>
                          <span>Country</span>
                          <input className={styles.input} onChange={(event) => updateZoneDraft(zone.id, { countryCode: event.target.value })} value={zone.countryCode} />
                        </label>
                        <label className={styles.field}>
                          <span>Province</span>
                          <input className={styles.input} onChange={(event) => updateZoneDraft(zone.id, { provinceCode: event.target.value })} value={zone.provinceCode} />
                        </label>
                        <label className={styles.field}>
                          <span>Priority</span>
                          <input className={styles.input} onChange={(event) => updateZoneDraft(zone.id, { priority: event.target.value })} value={zone.priority} />
                        </label>
                        <label className={styles.checkboxField}>
                          <input checked={zone.isActive} onChange={(event) => updateZoneDraft(zone.id, { isActive: event.target.checked })} type="checkbox" />
                          <span>Active</span>
                        </label>
                      </div>

                      <div className={styles.actionRow}>
                        <button className={styles.secondaryButton} onClick={() => handleSaveZone(zone)} type="button">
                          Save zone
                        </button>
                        <button className={styles.dangerButton} onClick={() => handleDeleteZone(zone.id)} type="button">
                          Delete zone
                        </button>
                      </div>

                      <div className={styles.rateList}>
                        {zone.rates.map((rate) => (
                          <div className={styles.rateRow} key={rate.id}>
                            <div className={styles.inlineGrid}>
                              <label className={styles.field}>
                                <span>Rate name</span>
                                <input className={styles.input} onChange={(event) => updateRateDraft(zone.id, rate.id, { name: event.target.value })} value={rate.name} />
                              </label>
                              <label className={styles.field}>
                                <span>Method</span>
                                <select className={styles.input} onChange={(event) => updateRateDraft(zone.id, rate.id, { method: event.target.value })} value={rate.method}>
                                  <option value="FLAT">Flat</option>
                                  <option value="SUBTOTAL_TIER">Subtotal tier</option>
                                </select>
                              </label>
                              <label className={styles.field}>
                                <span>Amount</span>
                                <input className={styles.input} onChange={(event) => updateRateDraft(zone.id, rate.id, { amount: event.target.value })} value={rate.amount} />
                              </label>
                              <label className={styles.field}>
                                <span>Min subtotal</span>
                                <input className={styles.input} onChange={(event) => updateRateDraft(zone.id, rate.id, { minSubtotal: event.target.value })} value={rate.minSubtotal} />
                              </label>
                              <label className={styles.field}>
                                <span>Max subtotal</span>
                                <input className={styles.input} onChange={(event) => updateRateDraft(zone.id, rate.id, { maxSubtotal: event.target.value })} value={rate.maxSubtotal} />
                              </label>
                              <label className={styles.field}>
                                <span>Priority</span>
                                <input className={styles.input} onChange={(event) => updateRateDraft(zone.id, rate.id, { priority: event.target.value })} value={rate.priority} />
                              </label>
                              <label className={styles.checkboxField}>
                                <input checked={rate.isActive} onChange={(event) => updateRateDraft(zone.id, rate.id, { isActive: event.target.checked })} type="checkbox" />
                                <span>Active</span>
                              </label>
                            </div>
                            <div className={styles.actionRow}>
                              <button className={styles.secondaryButton} onClick={() => handleSaveRate(zone.id, rate)} type="button">
                                Save rate
                              </button>
                              <button className={styles.dangerButton} onClick={() => handleDeleteRate(zone.id, rate.id)} type="button">
                                Delete rate
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className={styles.inlineGrid}>
                        <label className={styles.field}>
                          <span>New rate name</span>
                          <input
                            className={styles.input}
                            onChange={(event) =>
                              setNewRateByZoneId((current) => ({
                                ...current,
                                [zone.id]: {
                                  ...(current[zone.id] || EMPTY_RATE_FORM),
                                  name: event.target.value,
                                },
                              }))
                            }
                            value={(newRateByZoneId[zone.id] || EMPTY_RATE_FORM).name}
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Method</span>
                          <select
                            className={styles.input}
                            onChange={(event) =>
                              setNewRateByZoneId((current) => ({
                                ...current,
                                [zone.id]: {
                                  ...(current[zone.id] || EMPTY_RATE_FORM),
                                  method: event.target.value,
                                },
                              }))
                            }
                            value={(newRateByZoneId[zone.id] || EMPTY_RATE_FORM).method}
                          >
                            <option value="FLAT">Flat</option>
                            <option value="SUBTOTAL_TIER">Subtotal tier</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Amount</span>
                          <input
                            className={styles.input}
                            onChange={(event) =>
                              setNewRateByZoneId((current) => ({
                                ...current,
                                [zone.id]: {
                                  ...(current[zone.id] || EMPTY_RATE_FORM),
                                  amount: event.target.value,
                                },
                              }))
                            }
                            value={(newRateByZoneId[zone.id] || EMPTY_RATE_FORM).amount}
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Min subtotal</span>
                          <input
                            className={styles.input}
                            onChange={(event) =>
                              setNewRateByZoneId((current) => ({
                                ...current,
                                [zone.id]: {
                                  ...(current[zone.id] || EMPTY_RATE_FORM),
                                  minSubtotal: event.target.value,
                                },
                              }))
                            }
                            value={(newRateByZoneId[zone.id] || EMPTY_RATE_FORM).minSubtotal}
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Max subtotal</span>
                          <input
                            className={styles.input}
                            onChange={(event) =>
                              setNewRateByZoneId((current) => ({
                                ...current,
                                [zone.id]: {
                                  ...(current[zone.id] || EMPTY_RATE_FORM),
                                  maxSubtotal: event.target.value,
                                },
                              }))
                            }
                            value={(newRateByZoneId[zone.id] || EMPTY_RATE_FORM).maxSubtotal}
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Priority</span>
                          <input
                            className={styles.input}
                            onChange={(event) =>
                              setNewRateByZoneId((current) => ({
                                ...current,
                                [zone.id]: {
                                  ...(current[zone.id] || EMPTY_RATE_FORM),
                                  priority: event.target.value,
                                },
                              }))
                            }
                            value={(newRateByZoneId[zone.id] || EMPTY_RATE_FORM).priority}
                          />
                        </label>
                        <label className={styles.checkboxField}>
                          <input
                            checked={(newRateByZoneId[zone.id] || EMPTY_RATE_FORM).isActive}
                            onChange={(event) =>
                              setNewRateByZoneId((current) => ({
                                ...current,
                                [zone.id]: {
                                  ...(current[zone.id] || EMPTY_RATE_FORM),
                                  isActive: event.target.checked,
                                },
                              }))
                            }
                            type="checkbox"
                          />
                          <span>Active</span>
                        </label>
                        <button className={styles.secondaryButton} onClick={() => handleCreateRate(zone.id)} type="button">
                          Add rate
                        </button>
                      </div>
                    </div>
                  ))}
                </section>

                <section className={styles.configSection}>
                  <div className={styles.sectionHeading}>
                    <h3>Tax rules</h3>
                  </div>

                  <div className={styles.inlineGrid}>
                    <label className={styles.field}>
                      <span>Rule name</span>
                      <input className={styles.input} onChange={(event) => setNewTaxRule((current) => ({ ...current, name: event.target.value }))} value={newTaxRule.name} />
                    </label>
                    <label className={styles.field}>
                      <span>Country code</span>
                      <input className={styles.input} onChange={(event) => setNewTaxRule((current) => ({ ...current, countryCode: event.target.value }))} value={newTaxRule.countryCode} />
                    </label>
                    <label className={styles.field}>
                      <span>Province code</span>
                      <input className={styles.input} onChange={(event) => setNewTaxRule((current) => ({ ...current, provinceCode: event.target.value }))} value={newTaxRule.provinceCode} />
                    </label>
                    <label className={styles.field}>
                      <span>Tax rate (%)</span>
                      <input className={styles.input} onChange={(event) => setNewTaxRule((current) => ({ ...current, ratePercent: event.target.value }))} value={newTaxRule.ratePercent} />
                    </label>
                    <label className={styles.field}>
                      <span>Priority</span>
                      <input className={styles.input} onChange={(event) => setNewTaxRule((current) => ({ ...current, priority: event.target.value }))} value={newTaxRule.priority} />
                    </label>
                    <label className={styles.checkboxField}>
                      <input checked={newTaxRule.isActive} onChange={(event) => setNewTaxRule((current) => ({ ...current, isActive: event.target.checked }))} type="checkbox" />
                      <span>Active</span>
                    </label>
                    <button className={styles.secondaryButton} onClick={handleCreateTaxRule} type="button">
                      Add tax rule
                    </button>
                  </div>

                  {taxRules.map((rule) => (
                    <div className={styles.configRow} key={rule.id}>
                      <div className={styles.inlineGrid}>
                        <label className={styles.field}>
                          <span>Name</span>
                          <input className={styles.input} onChange={(event) => updateTaxRuleDraft(rule.id, { name: event.target.value })} value={rule.name} />
                        </label>
                        <label className={styles.field}>
                          <span>Country</span>
                          <input className={styles.input} onChange={(event) => updateTaxRuleDraft(rule.id, { countryCode: event.target.value })} value={rule.countryCode} />
                        </label>
                        <label className={styles.field}>
                          <span>Province</span>
                          <input className={styles.input} onChange={(event) => updateTaxRuleDraft(rule.id, { provinceCode: event.target.value })} value={rule.provinceCode} />
                        </label>
                        <label className={styles.field}>
                          <span>Tax rate (%)</span>
                          <input className={styles.input} onChange={(event) => updateTaxRuleDraft(rule.id, { ratePercent: event.target.value })} value={rule.ratePercent} />
                        </label>
                        <label className={styles.field}>
                          <span>Priority</span>
                          <input className={styles.input} onChange={(event) => updateTaxRuleDraft(rule.id, { priority: event.target.value })} value={rule.priority} />
                        </label>
                        <label className={styles.checkboxField}>
                          <input checked={rule.isActive} onChange={(event) => updateTaxRuleDraft(rule.id, { isActive: event.target.checked })} type="checkbox" />
                          <span>Active</span>
                        </label>
                      </div>
                      <div className={styles.actionRow}>
                        <button className={styles.secondaryButton} onClick={() => handleSaveTaxRule(rule)} type="button">
                          Save tax rule
                        </button>
                        <button className={styles.dangerButton} onClick={() => handleDeleteTaxRule(rule.id)} type="button">
                          Delete tax rule
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
              </div>
            ) : null}

            {!loading && !error && activeSection === 'payments' ? (
              <div className={styles.infoBlock}>Set payment providers, capture mode, manual payment methods, and refund rules here next.</div>
            ) : null}

            {!loading && !error && activeSection === 'notifications' ? (
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Sender email</span>
                  <input className={styles.input} onChange={(event) => updateSettings({ senderEmail: event.target.value })} value={settings.senderEmail} />
                </label>
              </div>
            ) : null}

            {!loading && !error && activeSection === 'users' ? (
              <div className={styles.infoBlock}>Staff accounts, roles, permissions, and approval rules should live here.</div>
            ) : null}

            {!loading && !error && activeSection === 'setup' ? (
              <div className={styles.setupPanel}>
                <section className={styles.setupSummaryCard}>
                  <div>
                    <p className={styles.eyebrow}>Setup health</p>
                    <h3 className={styles.setupHeadline}>{setupStatus?.overallStatus?.replaceAll('_', ' ') || 'Loading diagnostics'}</h3>
                    <p className={styles.statusText}>Completion: {setupStatus?.completionPercent ?? 0}%</p>
                  </div>
                  <div className={styles.setupMeterTrack} role="img" aria-label={`Setup completion ${setupStatus?.completionPercent ?? 0}%`}>
                    <div className={styles.setupMeterFill} style={{ width: `${setupStatus?.completionPercent ?? 0}%` }} />
                  </div>
                </section>

                {setupLoading ? (
                  <div className={styles.statusBlock}>
                    <div className={styles.loadingLine} />
                    <div className={styles.loadingLine} />
                    <div className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
                    <p className={styles.statusText}>Loading setup diagnostics...</p>
                  </div>
                ) : null}

                {setupError ? (
                  <div className={styles.statusBlock}>
                    <p className={styles.statusTitle}>Setup diagnostics error</p>
                    <p className={styles.statusText}>{setupError}</p>
                  </div>
                ) : null}

                {!setupLoading && !setupError ? (
                  <>
                    <section className={styles.setupGrid}>
                      {setupCards.map((card) => (
                        <article className={styles.setupCard} key={card.id}>
                          <div className={styles.setupCardHeader}>
                            <h4>{card.label}</h4>
                            <span
                              className={
                                card.status === 'PASS'
                                  ? styles.setupBadgePass
                                  : card.status === 'FAIL'
                                    ? styles.setupBadgeFail
                                    : styles.setupBadgeWarn
                              }
                            >
                              {card.status}
                            </span>
                          </div>
                          <p className={styles.statusText}>{card.summary}</p>
                          {card.fix ? <p className={styles.setupFixText}>Fix: {card.fix}</p> : null}
                        </article>
                      ))}
                    </section>

                    <section className={styles.setupColumns}>
                      <article className={styles.setupColumnCard}>
                        <h4>Missing env warnings</h4>
                        {setupMissingEnvVars.length ? (
                          <div className={styles.warningTagList}>
                            {setupMissingEnvVars.map((envName) => (
                              <span className={styles.warningTag} key={envName}>
                                {envName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className={styles.statusText}>No env variable gaps detected in current diagnostics.</p>
                        )}
                      </article>

                      <article className={styles.setupColumnCard}>
                        <h4>Copy/paste CLI commands</h4>
                        <div className={styles.commandList}>
                          {SETUP_COMMANDS.map((entry) => (
                            <div className={styles.commandRow} key={entry.id}>
                              <code className={styles.commandCode}>{entry.command}</code>
                              <button
                                className={styles.secondaryButton}
                                onClick={() => handleCopyCommand(entry.id, entry.command)}
                                type="button"
                              >
                                {setupCopiedCommandId === entry.id ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </article>
                    </section>

                    <section className={styles.setupColumns}>
                      <article className={styles.setupColumnCard}>
                        <h4>Safe next actions</h4>
                        {setupStatus?.safeNextActions?.length ? (
                          <ul className={styles.setupList}>
                            {setupStatus.safeNextActions.map((action) => (
                              <li key={action}>{action}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className={styles.statusText}>No required fixes right now.</p>
                        )}
                      </article>

                      <article className={styles.setupColumnCard}>
                        <h4>Provider connection hints</h4>
                        <ul className={styles.setupList}>
                          {PROVIDER_HINTS.map((hint) => (
                            <li key={hint}>{hint}</li>
                          ))}
                        </ul>
                      </article>
                    </section>
                  </>
                ) : null}
              </div>
            ) : null}

            {!loading && !error && activeSection === 'integrations' ? (
              <IntegrationsPanel />
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
