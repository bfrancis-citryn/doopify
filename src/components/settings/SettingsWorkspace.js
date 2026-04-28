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
  { id: 'integrations', label: 'Integrations & Webhooks' },
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
          <div aria-busy={loading || shippingConfigLoading} className={styles.detailCard}>
            <div className={styles.detailHeader}>
              <div>
                <p className={styles.eyebrow}>Settings</p>
                <h2 className={styles.title}>{activeTitle}</h2>
              </div>
              <button className={styles.saveButton} disabled={loading || Boolean(error)} type="button">
                Save
              </button>
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

            {!loading && !error && activeSection === 'integrations' ? (
              <IntegrationsPanel />
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
