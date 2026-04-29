"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import AppShell from '../AppShell';
import styles from './SettingsWorkspace.module.css';

const EMPTY_ZONE = {
  name: '',
  countryCode: '',
  provinceCode: '',
  priority: '100',
  isActive: true,
};

const EMPTY_RATE = {
  name: '',
  method: 'FLAT',
  amount: '',
  minSubtotal: '',
  maxSubtotal: '',
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

async function parseApiJson(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Request failed');
  }
  return payload.data;
}

function normalizeCountryCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized === 'USA' || normalized === 'UNITED STATES') return 'US';
  return normalized;
}

function normalizeProvinceCode(value) {
  return String(value || '').trim().toUpperCase();
}

function mapZoneForm(zone) {
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

function computeManualPreview(input) {
  const subtotal = parseNumberOrUndefined(input.subtotal) ?? 0;
  const destinationCountry = normalizeCountryCode(input.countryCode);
  const destinationProvince = normalizeProvinceCode(input.provinceCode);
  const threshold = parseNumberOrUndefined(input.shippingThreshold);

  if (subtotal <= 0) {
    return { amount: 0, source: 'none', label: 'No shipping for empty subtotal' };
  }

  if (threshold != null && subtotal >= threshold) {
    return { amount: 0, source: 'threshold', label: `Free shipping threshold met at $${threshold.toFixed(2)}` };
  }

  const zones = input.shippingZones
    .filter((zone) => zone.isActive)
    .filter((zone) => normalizeCountryCode(zone.countryCode) === destinationCountry)
    .filter((zone) => {
      const province = normalizeProvinceCode(zone.provinceCode);
      return !province || province === destinationProvince;
    })
    .sort((left, right) => {
      const leftPriority = Number(left.priority || 100);
      const rightPriority = Number(right.priority || 100);
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;

      const leftSpecificity = normalizeProvinceCode(left.provinceCode) ? 1 : 0;
      const rightSpecificity = normalizeProvinceCode(right.provinceCode) ? 1 : 0;
      return rightSpecificity - leftSpecificity;
    });

  const matchedZone = zones[0];
  if (matchedZone) {
    const eligibleRates = matchedZone.rates
      .filter((rate) => rate.isActive)
      .filter((rate) => {
        if (rate.method !== 'SUBTOTAL_TIER') return true;
        const min = parseNumberOrNull(rate.minSubtotal);
        const max = parseNumberOrNull(rate.maxSubtotal);
        if (min != null && subtotal < min) return false;
        if (max != null && subtotal > max) return false;
        return true;
      })
      .sort((left, right) => {
        const leftPriority = Number(left.priority || 100);
        const rightPriority = Number(right.priority || 100);
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return (parseNumberOrUndefined(right.minSubtotal) ?? -1) - (parseNumberOrUndefined(left.minSubtotal) ?? -1);
      });

    const matchedRate = eligibleRates[0];
    if (matchedRate) {
      const amount = parseNumberOrUndefined(matchedRate.amount) ?? 0;
      return {
        amount,
        source: 'zone',
        label: `${matchedZone.name} • ${matchedRate.name}`,
      };
    }
  }

  const storeCountry = normalizeCountryCode(input.storeCountry);
  const isInternational = destinationCountry && storeCountry && destinationCountry !== storeCountry;
  const amount = isInternational
    ? parseNumberOrUndefined(input.shippingInternationalRate) ?? 0
    : parseNumberOrUndefined(input.shippingDomesticRate) ?? 0;

  return {
    amount,
    source: 'fallback',
    label: isInternational ? 'International fallback rate' : 'Domestic fallback rate',
  };
}

export default function ShippingSettingsWorkspace() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [storeId, setStoreId] = useState('');
  const [storeCountry, setStoreCountry] = useState('');
  const [shippingMode, setShippingMode] = useState('MANUAL');
  const [shippingLiveProvider, setShippingLiveProvider] = useState('');
  const [shippingThreshold, setShippingThreshold] = useState('');
  const [shippingDomesticRate, setShippingDomesticRate] = useState('');
  const [shippingInternationalRate, setShippingInternationalRate] = useState('');
  const [shippingZones, setShippingZones] = useState([]);

  const [newZone, setNewZone] = useState(EMPTY_ZONE);
  const [newRateByZoneId, setNewRateByZoneId] = useState({});
  const [previewInput, setPreviewInput] = useState({
    subtotal: '75',
    countryCode: 'US',
    provinceCode: '',
  });

  const loadShippingSettings = useCallback(async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const data = await fetch('/api/settings/shipping').then(parseApiJson);
      setStoreId(data.storeId || '');
      setStoreCountry(data.storeCountry || '');
      setShippingMode(data.shippingMode || 'MANUAL');
      setShippingLiveProvider(data.shippingLiveProvider || '');
      setShippingThreshold(data.shippingThreshold == null ? '' : String(data.shippingThreshold));
      setShippingDomesticRate(String(data.shippingDomesticRate ?? ''));
      setShippingInternationalRate(String(data.shippingInternationalRate ?? ''));
      setShippingZones((data.shippingZones || []).map(mapZoneForm));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load shipping settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShippingSettings();
  }, [loadShippingSettings]);

  const previewResult = useMemo(
    () =>
      computeManualPreview({
        subtotal: previewInput.subtotal,
        countryCode: previewInput.countryCode,
        provinceCode: previewInput.provinceCode,
        shippingThreshold,
        shippingDomesticRate,
        shippingInternationalRate,
        shippingZones,
        storeCountry,
      }),
    [
      previewInput.countryCode,
      previewInput.provinceCode,
      previewInput.subtotal,
      shippingDomesticRate,
      shippingInternationalRate,
      shippingThreshold,
      shippingZones,
      storeCountry,
    ]
  );

  async function saveShippingSettings() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await fetch('/api/settings/shipping', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingMode,
          shippingLiveProvider: shippingLiveProvider || null,
          shippingThreshold: parseNumberOrNull(shippingThreshold),
          shippingDomesticRate: parseNumberOrUndefined(shippingDomesticRate),
          shippingInternationalRate: parseNumberOrUndefined(shippingInternationalRate),
        }),
      }).then(parseApiJson);

      setSuccess('Shipping settings saved.');
      await loadShippingSettings();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save shipping settings');
    } finally {
      setSaving(false);
    }
  }

  async function createZone() {
    setError('');
    setSuccess('');
    try {
      await fetch('/api/settings/shipping-zones', {
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

      setNewZone(EMPTY_ZONE);
      await loadShippingSettings();
    } catch (zoneError) {
      setError(zoneError instanceof Error ? zoneError.message : 'Failed to create shipping zone');
    }
  }

  async function saveZone(zone) {
    setError('');
    setSuccess('');
    try {
      await fetch(`/api/settings/shipping-zones/${zone.id}`, {
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

      await loadShippingSettings();
    } catch (zoneError) {
      setError(zoneError instanceof Error ? zoneError.message : 'Failed to save shipping zone');
    }
  }

  async function deleteZone(zoneId) {
    setError('');
    setSuccess('');
    try {
      await fetch(`/api/settings/shipping-zones/${zoneId}`, {
        method: 'DELETE',
      }).then(parseApiJson);
      await loadShippingSettings();
    } catch (zoneError) {
      setError(zoneError instanceof Error ? zoneError.message : 'Failed to delete shipping zone');
    }
  }

  async function saveRate(zoneId, rate) {
    setError('');
    setSuccess('');
    try {
      await fetch(`/api/settings/shipping-zones/${zoneId}/rates/${rate.id}`, {
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

      await loadShippingSettings();
    } catch (rateError) {
      setError(rateError instanceof Error ? rateError.message : 'Failed to save shipping rate');
    }
  }

  async function createRate(zoneId) {
    const draft = newRateByZoneId[zoneId] || EMPTY_RATE;
    setError('');
    setSuccess('');

    try {
      await fetch(`/api/settings/shipping-zones/${zoneId}/rates`, {
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

      setNewRateByZoneId((current) => ({
        ...current,
        [zoneId]: { ...EMPTY_RATE },
      }));
      await loadShippingSettings();
    } catch (rateError) {
      setError(rateError instanceof Error ? rateError.message : 'Failed to create shipping rate');
    }
  }

  async function deleteRate(zoneId, rateId) {
    setError('');
    setSuccess('');
    try {
      await fetch(`/api/settings/shipping-zones/${zoneId}/rates/${rateId}`, {
        method: 'DELETE',
      }).then(parseApiJson);
      await loadShippingSettings();
    } catch (rateError) {
      setError(rateError instanceof Error ? rateError.message : 'Failed to delete shipping rate');
    }
  }

  return (
    <AppShell>
      <div className={styles.pageWrap}>
        <div className={styles.pageHeader}>
          <div>
            <h2>Shipping Settings</h2>
            <p>Configure manual rates, mode selection, and zone-level subtotal tiers.</p>
            {storeId ? <p className={styles.statusText}>Store: {storeId}</p> : null}
          </div>
          <div className={styles.actionRow}>
            <Link className={styles.secondaryButton} href="/admin/settings/shipping/setup">
              Open setup wizard
            </Link>
            <button className={styles.primaryButton} disabled={saving} onClick={saveShippingSettings} type="button">
              {saving ? 'Saving...' : 'Save shipping settings'}
            </button>
          </div>
        </div>

        {loading ? <p className={styles.statusText}>Loading shipping settings...</p> : null}
        {error ? (
          <div className={styles.statusBlock}>
            <p className={styles.statusTitle}>Shipping configuration error</p>
            <p className={styles.statusText}>{error}</p>
          </div>
        ) : null}
        {success ? (
          <div className={styles.statusBlock}>
            <p className={styles.statusTitle}>{success}</p>
          </div>
        ) : null}

        {!loading ? (
          <div className={styles.configStack}>
            <section className={styles.configSection}>
              <div className={styles.sectionHeading}>
                <h3>Shipping mode</h3>
              </div>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Mode</span>
                  <select className={styles.input} onChange={(event) => setShippingMode(event.target.value)} value={shippingMode}>
                    <option value="MANUAL">Manual</option>
                    <option value="LIVE_RATES">Live rates</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Live provider</span>
                  <select className={styles.input} onChange={(event) => setShippingLiveProvider(event.target.value)} value={shippingLiveProvider}>
                    <option value="">Not connected</option>
                    <option value="EASYPOST">EasyPost</option>
                    <option value="SHIPPO">Shippo</option>
                  </select>
                </label>
              </div>
            </section>

            <section className={styles.configSection}>
              <div className={styles.sectionHeading}>
                <h3>Manual flat rates</h3>
              </div>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Domestic flat rate (USD)</span>
                  <input className={styles.input} onChange={(event) => setShippingDomesticRate(event.target.value)} value={shippingDomesticRate} />
                </label>
                <label className={styles.field}>
                  <span>International flat rate (USD)</span>
                  <input className={styles.input} onChange={(event) => setShippingInternationalRate(event.target.value)} value={shippingInternationalRate} />
                </label>
              </div>
            </section>

            <section className={styles.configSection}>
              <div className={styles.sectionHeading}>
                <h3>Free-shipping threshold</h3>
              </div>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Threshold subtotal (USD)</span>
                  <input className={styles.input} onChange={(event) => setShippingThreshold(event.target.value)} value={shippingThreshold} />
                </label>
              </div>
            </section>

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
                <button className={styles.secondaryButton} onClick={createZone} type="button">
                  Add zone
                </button>
              </div>

              {shippingZones.map((zone) => (
                <div className={styles.configRow} key={zone.id}>
                  <div className={styles.inlineGrid}>
                    <label className={styles.field}>
                      <span>Name</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setShippingZones((current) =>
                            current.map((entry) => (entry.id === zone.id ? { ...entry, name: event.target.value } : entry))
                          )
                        }
                        value={zone.name}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Country</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setShippingZones((current) =>
                            current.map((entry) =>
                              entry.id === zone.id ? { ...entry, countryCode: event.target.value } : entry
                            )
                          )
                        }
                        value={zone.countryCode}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Province</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setShippingZones((current) =>
                            current.map((entry) =>
                              entry.id === zone.id ? { ...entry, provinceCode: event.target.value } : entry
                            )
                          )
                        }
                        value={zone.provinceCode}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Priority</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setShippingZones((current) =>
                            current.map((entry) =>
                              entry.id === zone.id ? { ...entry, priority: event.target.value } : entry
                            )
                          )
                        }
                        value={zone.priority}
                      />
                    </label>
                    <label className={styles.checkboxField}>
                      <input
                        checked={zone.isActive}
                        onChange={(event) =>
                          setShippingZones((current) =>
                            current.map((entry) =>
                              entry.id === zone.id ? { ...entry, isActive: event.target.checked } : entry
                            )
                          )
                        }
                        type="checkbox"
                      />
                      <span>Active</span>
                    </label>
                  </div>

                  <div className={styles.actionRow}>
                    <button className={styles.secondaryButton} onClick={() => saveZone(zone)} type="button">
                      Save zone
                    </button>
                    <button className={styles.dangerButton} onClick={() => deleteZone(zone.id)} type="button">
                      Delete zone
                    </button>
                  </div>

                  <div className={styles.rateList}>
                    {zone.rates.map((rate) => (
                      <div className={styles.rateRow} key={rate.id}>
                        <div className={styles.inlineGrid}>
                          <label className={styles.field}>
                            <span>Rate name</span>
                            <input
                              className={styles.input}
                              onChange={(event) =>
                                setShippingZones((current) =>
                                  current.map((entry) =>
                                    entry.id === zone.id
                                      ? {
                                          ...entry,
                                          rates: entry.rates.map((zoneRate) =>
                                            zoneRate.id === rate.id
                                              ? { ...zoneRate, name: event.target.value }
                                              : zoneRate
                                          ),
                                        }
                                      : entry
                                  )
                                )
                              }
                              value={rate.name}
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Method</span>
                            <select
                              className={styles.input}
                              onChange={(event) =>
                                setShippingZones((current) =>
                                  current.map((entry) =>
                                    entry.id === zone.id
                                      ? {
                                          ...entry,
                                          rates: entry.rates.map((zoneRate) =>
                                            zoneRate.id === rate.id
                                              ? { ...zoneRate, method: event.target.value }
                                              : zoneRate
                                          ),
                                        }
                                      : entry
                                  )
                                )
                              }
                              value={rate.method}
                            >
                              <option value="FLAT">Flat</option>
                              <option value="SUBTOTAL_TIER">Subtotal tier</option>
                            </select>
                          </label>
                          <label className={styles.field}>
                            <span>Amount (USD)</span>
                            <input
                              className={styles.input}
                              onChange={(event) =>
                                setShippingZones((current) =>
                                  current.map((entry) =>
                                    entry.id === zone.id
                                      ? {
                                          ...entry,
                                          rates: entry.rates.map((zoneRate) =>
                                            zoneRate.id === rate.id
                                              ? { ...zoneRate, amount: event.target.value }
                                              : zoneRate
                                          ),
                                        }
                                      : entry
                                  )
                                )
                              }
                              value={rate.amount}
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Min subtotal</span>
                            <input
                              className={styles.input}
                              onChange={(event) =>
                                setShippingZones((current) =>
                                  current.map((entry) =>
                                    entry.id === zone.id
                                      ? {
                                          ...entry,
                                          rates: entry.rates.map((zoneRate) =>
                                            zoneRate.id === rate.id
                                              ? { ...zoneRate, minSubtotal: event.target.value }
                                              : zoneRate
                                          ),
                                        }
                                      : entry
                                  )
                                )
                              }
                              value={rate.minSubtotal}
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Max subtotal</span>
                            <input
                              className={styles.input}
                              onChange={(event) =>
                                setShippingZones((current) =>
                                  current.map((entry) =>
                                    entry.id === zone.id
                                      ? {
                                          ...entry,
                                          rates: entry.rates.map((zoneRate) =>
                                            zoneRate.id === rate.id
                                              ? { ...zoneRate, maxSubtotal: event.target.value }
                                              : zoneRate
                                          ),
                                        }
                                      : entry
                                  )
                                )
                              }
                              value={rate.maxSubtotal}
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Priority</span>
                            <input
                              className={styles.input}
                              onChange={(event) =>
                                setShippingZones((current) =>
                                  current.map((entry) =>
                                    entry.id === zone.id
                                      ? {
                                          ...entry,
                                          rates: entry.rates.map((zoneRate) =>
                                            zoneRate.id === rate.id
                                              ? { ...zoneRate, priority: event.target.value }
                                              : zoneRate
                                          ),
                                        }
                                      : entry
                                  )
                                )
                              }
                              value={rate.priority}
                            />
                          </label>
                          <label className={styles.checkboxField}>
                            <input
                              checked={rate.isActive}
                              onChange={(event) =>
                                setShippingZones((current) =>
                                  current.map((entry) =>
                                    entry.id === zone.id
                                      ? {
                                          ...entry,
                                          rates: entry.rates.map((zoneRate) =>
                                            zoneRate.id === rate.id
                                              ? { ...zoneRate, isActive: event.target.checked }
                                              : zoneRate
                                          ),
                                        }
                                      : entry
                                  )
                                )
                              }
                              type="checkbox"
                            />
                            <span>Active</span>
                          </label>
                        </div>
                        <div className={styles.actionRow}>
                          <button className={styles.secondaryButton} onClick={() => saveRate(zone.id, rate)} type="button">
                            Save rate
                          </button>
                          <button className={styles.dangerButton} onClick={() => deleteRate(zone.id, rate.id)} type="button">
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
                              ...(current[zone.id] || EMPTY_RATE),
                              name: event.target.value,
                            },
                          }))
                        }
                        value={(newRateByZoneId[zone.id] || EMPTY_RATE).name}
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
                              ...(current[zone.id] || EMPTY_RATE),
                              method: event.target.value,
                            },
                          }))
                        }
                        value={(newRateByZoneId[zone.id] || EMPTY_RATE).method}
                      >
                        <option value="FLAT">Flat</option>
                        <option value="SUBTOTAL_TIER">Subtotal tier</option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Amount (USD)</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setNewRateByZoneId((current) => ({
                            ...current,
                            [zone.id]: {
                              ...(current[zone.id] || EMPTY_RATE),
                              amount: event.target.value,
                            },
                          }))
                        }
                        value={(newRateByZoneId[zone.id] || EMPTY_RATE).amount}
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
                              ...(current[zone.id] || EMPTY_RATE),
                              minSubtotal: event.target.value,
                            },
                          }))
                        }
                        value={(newRateByZoneId[zone.id] || EMPTY_RATE).minSubtotal}
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
                              ...(current[zone.id] || EMPTY_RATE),
                              maxSubtotal: event.target.value,
                            },
                          }))
                        }
                        value={(newRateByZoneId[zone.id] || EMPTY_RATE).maxSubtotal}
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
                              ...(current[zone.id] || EMPTY_RATE),
                              priority: event.target.value,
                            },
                          }))
                        }
                        value={(newRateByZoneId[zone.id] || EMPTY_RATE).priority}
                      />
                    </label>
                    <label className={styles.checkboxField}>
                      <input
                        checked={(newRateByZoneId[zone.id] || EMPTY_RATE).isActive}
                        onChange={(event) =>
                          setNewRateByZoneId((current) => ({
                            ...current,
                            [zone.id]: {
                              ...(current[zone.id] || EMPTY_RATE),
                              isActive: event.target.checked,
                            },
                          }))
                        }
                        type="checkbox"
                      />
                      <span>Active</span>
                    </label>
                    <button className={styles.secondaryButton} onClick={() => createRate(zone.id)} type="button">
                      Add rate
                    </button>
                  </div>
                </div>
              ))}
            </section>

            <section className={styles.configSection}>
              <div className={styles.sectionHeading}>
                <h3>Manual rate preview</h3>
              </div>
              <div className={styles.inlineGrid}>
                <label className={styles.field}>
                  <span>Subtotal (USD)</span>
                  <input className={styles.input} onChange={(event) => setPreviewInput((current) => ({ ...current, subtotal: event.target.value }))} value={previewInput.subtotal} />
                </label>
                <label className={styles.field}>
                  <span>Destination country</span>
                  <input className={styles.input} onChange={(event) => setPreviewInput((current) => ({ ...current, countryCode: event.target.value }))} value={previewInput.countryCode} />
                </label>
                <label className={styles.field}>
                  <span>Destination province</span>
                  <input className={styles.input} onChange={(event) => setPreviewInput((current) => ({ ...current, provinceCode: event.target.value }))} value={previewInput.provinceCode} />
                </label>
              </div>
              <div className={styles.statusBlock}>
                <p className={styles.statusTitle}>Preview amount: ${Number(previewResult.amount || 0).toFixed(2)}</p>
                <p className={styles.statusText}>{previewResult.label}</p>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
