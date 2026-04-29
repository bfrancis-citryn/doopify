"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import AppShell from '../AppShell';
import styles from './SettingsWorkspace.module.css';

const STEPS = [
  'Choose mode',
  'Origin address',
  'Default package',
  'Manual fallback rates',
  'Live provider',
  'Test rates',
  'Summary',
];

async function parseApiJson(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Request failed');
  }
  return payload.data;
}

function normalizeNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeInteger(value) {
  const parsed = normalizeNumber(value);
  if (parsed == null) return null;
  return Math.round(parsed);
}

export default function ShippingSetupWorkspace() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [setup, setSetup] = useState({
    shippingMode: 'MANUAL',
    shippingLiveProvider: '',
    shippingOriginName: '',
    shippingOriginPhone: '',
    shippingOriginAddress1: '',
    shippingOriginAddress2: '',
    shippingOriginCity: '',
    shippingOriginProvince: '',
    shippingOriginPostalCode: '',
    shippingOriginCountry: '',
    defaultPackageWeightOz: '',
    defaultPackageLengthIn: '',
    defaultPackageWidthIn: '',
    defaultPackageHeightIn: '',
    defaultLabelFormat: 'PDF',
    defaultLabelSize: '4x6',
    shippingFallbackEnabled: true,
    shippingThreshold: '',
    shippingDomesticRate: '',
    shippingInternationalRate: '',
  });

  const [status, setStatus] = useState(null);
  const [testInput, setTestInput] = useState({
    subtotal: '75',
    destinationCountry: 'US',
    destinationProvince: '',
  });
  const [testQuotes, setTestQuotes] = useState([]);
  const [providerApiKey, setProviderApiKey] = useState('');
  const [providerTesting, setProviderTesting] = useState(false);
  const [providerResult, setProviderResult] = useState(null);

  const loadSetup = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const [shippingData, statusData] = await Promise.all([
        fetch('/api/settings/shipping').then(parseApiJson),
        fetch('/api/settings/shipping/setup-status').then(parseApiJson),
      ]);

      setSetup((current) => ({
        ...current,
        shippingMode: shippingData.shippingMode || 'MANUAL',
        shippingLiveProvider: shippingData.shippingLiveProvider || '',
        shippingOriginName: shippingData.shippingOriginName || '',
        shippingOriginPhone: shippingData.shippingOriginPhone || '',
        shippingOriginAddress1: shippingData.shippingOriginAddress1 || '',
        shippingOriginAddress2: shippingData.shippingOriginAddress2 || '',
        shippingOriginCity: shippingData.shippingOriginCity || '',
        shippingOriginProvince: shippingData.shippingOriginProvince || '',
        shippingOriginPostalCode: shippingData.shippingOriginPostalCode || '',
        shippingOriginCountry: shippingData.shippingOriginCountry || '',
        defaultPackageWeightOz:
          shippingData.defaultPackageWeightOz == null ? '' : String(shippingData.defaultPackageWeightOz),
        defaultPackageLengthIn:
          shippingData.defaultPackageLengthIn == null ? '' : String(shippingData.defaultPackageLengthIn),
        defaultPackageWidthIn:
          shippingData.defaultPackageWidthIn == null ? '' : String(shippingData.defaultPackageWidthIn),
        defaultPackageHeightIn:
          shippingData.defaultPackageHeightIn == null ? '' : String(shippingData.defaultPackageHeightIn),
        defaultLabelFormat: shippingData.defaultLabelFormat || 'PDF',
        defaultLabelSize: shippingData.defaultLabelSize || '4x6',
        shippingFallbackEnabled: shippingData.shippingFallbackEnabled !== false,
        shippingThreshold: shippingData.shippingThreshold == null ? '' : String(shippingData.shippingThreshold),
        shippingDomesticRate:
          shippingData.shippingDomesticRate == null ? '' : String(shippingData.shippingDomesticRate),
        shippingInternationalRate:
          shippingData.shippingInternationalRate == null ? '' : String(shippingData.shippingInternationalRate),
      }));

      setStatus(statusData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load shipping setup');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSetup();
  }, [loadSetup]);

  const summaryLines = useMemo(() => {
    if (!status) return [];
    return [
      `Mode: ${status.mode}`,
      `Origin address: ${status.hasOriginAddress ? 'ready' : 'missing'}`,
      `Default package: ${status.hasDefaultPackage ? 'ready' : 'missing'}`,
      `Manual rates: ${status.hasManualRates ? 'ready' : 'missing'}`,
      `Provider selected: ${status.hasProvider ? 'yes' : 'no'}`,
      `Provider connected: ${status.providerConnected ? 'yes' : 'no'}`,
      `Can use manual rates: ${status.canUseManualRates ? 'yes' : 'no'}`,
      `Can use live rates: ${status.canUseLiveRates ? 'yes' : 'no'}`,
      `Can buy labels: ${status.canBuyLabels ? 'yes' : 'no'}`,
    ];
  }, [status]);

  async function savePatch(patch) {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const data = await fetch('/api/settings/shipping/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(parseApiJson);

      setStatus(data.status);
      setSuccess('Shipping setup step saved.');
      await loadSetup();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save shipping setup step');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestRates() {
    setTesting(true);
    setError('');
    setSuccess('');

    try {
      const data = await fetch('/api/settings/shipping/test-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtotal: normalizeNumber(testInput.subtotal) ?? 0,
          destinationCountry: testInput.destinationCountry,
          destinationProvince: testInput.destinationProvince || null,
        }),
      }).then(parseApiJson);

      setTestQuotes(Array.isArray(data.quotes) ? data.quotes : []);
      setStatus(data.status);
      setSuccess('Shipping rate test completed.');
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Failed to test shipping rates');
    } finally {
      setTesting(false);
    }
  }

  async function handleConnectProvider() {
    setSaving(true);
    setError('');
    setSuccess('');
    setProviderResult(null);

    try {
      if (!setup.shippingLiveProvider) {
        throw new Error('Select a provider first.');
      }
      if (!providerApiKey.trim()) {
        throw new Error('Enter your provider API key.');
      }

      await fetch('/api/settings/shipping/connect-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: setup.shippingLiveProvider,
          apiKey: providerApiKey,
        }),
      }).then(parseApiJson);

      setSuccess('Provider credentials saved.');
      await loadSetup();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Failed to connect provider');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnectProvider() {
    setSaving(true);
    setError('');
    setSuccess('');
    setProviderResult(null);

    try {
      if (!setup.shippingLiveProvider) {
        throw new Error('Select a provider first.');
      }

      await fetch('/api/settings/shipping/disconnect-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: setup.shippingLiveProvider,
        }),
      }).then(parseApiJson);

      setSuccess('Provider disconnected.');
      setProviderApiKey('');
      await loadSetup();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : 'Failed to disconnect provider');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestProvider() {
    setProviderTesting(true);
    setError('');
    setSuccess('');

    try {
      if (!setup.shippingLiveProvider) {
        throw new Error('Select a provider first.');
      }

      const data = await fetch('/api/settings/shipping/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: setup.shippingLiveProvider,
        }),
      }).then(parseApiJson);

      setProviderResult(data.result);
      setSuccess(data.result?.ok ? 'Provider test succeeded.' : 'Provider test failed.');
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Failed to test provider');
    } finally {
      setProviderTesting(false);
    }
  }

  function nextStep() {
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function prevStep() {
    setStep((current) => Math.max(current - 1, 0));
  }

  return (
    <AppShell>
      <div className={styles.pageWrap}>
        <div className={styles.pageHeader}>
          <div>
            <h2>Shipping Setup Wizard</h2>
            <p>Save each step and resume anytime from persisted shipping setup state.</p>
          </div>
          <button className={styles.primaryButton} onClick={loadSetup} type="button">
            Refresh status
          </button>
        </div>

        <div className={styles.statusBlock}>
          <p className={styles.statusTitle}>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
          <p className={styles.statusText}>
            {status?.warnings?.length ? `Warnings: ${status.warnings.length}` : 'No current warnings.'}
          </p>
        </div>

        {loading ? <p className={styles.statusText}>Loading shipping setup...</p> : null}
        {error ? (
          <div className={styles.statusBlock}>
            <p className={styles.statusTitle}>Shipping setup error</p>
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
            {step === 0 ? (
              <section className={styles.configSection}>
                <div className={styles.sectionHeading}>
                  <h3>Choose shipping mode</h3>
                </div>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Shipping mode</span>
                    <select
                      className={styles.input}
                      onChange={(event) => setSetup((current) => ({ ...current, shippingMode: event.target.value }))}
                      value={setup.shippingMode}
                    >
                      <option value="MANUAL">Manual</option>
                      <option value="LIVE_RATES">Live rates</option>
                      <option value="HYBRID">Hybrid</option>
                    </select>
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      checked={setup.shippingFallbackEnabled}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, shippingFallbackEnabled: event.target.checked }))
                      }
                      type="checkbox"
                    />
                    <span>Enable manual fallback rates</span>
                  </label>
                </div>
                <div className={styles.actionRow}>
                  <button
                    className={styles.secondaryButton}
                    disabled={saving}
                    onClick={() =>
                      savePatch({
                        shippingMode: setup.shippingMode,
                        shippingFallbackEnabled: setup.shippingFallbackEnabled,
                      })
                    }
                    type="button"
                  >
                    {saving ? 'Saving...' : 'Save step'}
                  </button>
                </div>
              </section>
            ) : null}

            {step === 1 ? (
              <section className={styles.configSection}>
                <div className={styles.sectionHeading}>
                  <h3>Origin address</h3>
                </div>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Name</span>
                    <input
                      className={styles.input}
                      onChange={(event) => setSetup((current) => ({ ...current, shippingOriginName: event.target.value }))}
                      value={setup.shippingOriginName}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Phone</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, shippingOriginPhone: event.target.value }))
                      }
                      value={setup.shippingOriginPhone}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Address line 1</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, shippingOriginAddress1: event.target.value }))
                      }
                      value={setup.shippingOriginAddress1}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Address line 2</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, shippingOriginAddress2: event.target.value }))
                      }
                      value={setup.shippingOriginAddress2}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>City</span>
                    <input
                      className={styles.input}
                      onChange={(event) => setSetup((current) => ({ ...current, shippingOriginCity: event.target.value }))}
                      value={setup.shippingOriginCity}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Province/State</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, shippingOriginProvince: event.target.value }))
                      }
                      value={setup.shippingOriginProvince}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Postal code</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, shippingOriginPostalCode: event.target.value }))
                      }
                      value={setup.shippingOriginPostalCode}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Country code (ISO2/ISO3)</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, shippingOriginCountry: event.target.value }))
                      }
                      value={setup.shippingOriginCountry}
                    />
                  </label>
                </div>
                <div className={styles.actionRow}>
                  <button
                    className={styles.secondaryButton}
                    disabled={saving}
                    onClick={() =>
                      savePatch({
                        shippingOriginName: setup.shippingOriginName || null,
                        shippingOriginPhone: setup.shippingOriginPhone || null,
                        shippingOriginAddress1: setup.shippingOriginAddress1 || null,
                        shippingOriginAddress2: setup.shippingOriginAddress2 || null,
                        shippingOriginCity: setup.shippingOriginCity || null,
                        shippingOriginProvince: setup.shippingOriginProvince || null,
                        shippingOriginPostalCode: setup.shippingOriginPostalCode || null,
                        shippingOriginCountry: setup.shippingOriginCountry || null,
                      })
                    }
                    type="button"
                  >
                    {saving ? 'Saving...' : 'Save step'}
                  </button>
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className={styles.configSection}>
                <div className={styles.sectionHeading}>
                  <h3>Default package</h3>
                </div>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Weight (oz)</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, defaultPackageWeightOz: event.target.value }))
                      }
                      value={setup.defaultPackageWeightOz}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Length (in)</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, defaultPackageLengthIn: event.target.value }))
                      }
                      value={setup.defaultPackageLengthIn}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Width (in)</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, defaultPackageWidthIn: event.target.value }))
                      }
                      value={setup.defaultPackageWidthIn}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Height (in)</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, defaultPackageHeightIn: event.target.value }))
                      }
                      value={setup.defaultPackageHeightIn}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Label format</span>
                    <select
                      className={styles.input}
                      onChange={(event) => setSetup((current) => ({ ...current, defaultLabelFormat: event.target.value }))}
                      value={setup.defaultLabelFormat}
                    >
                      <option value="PDF">PDF</option>
                      <option value="PNG">PNG</option>
                      <option value="ZPL">ZPL</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Label size</span>
                    <select
                      className={styles.input}
                      onChange={(event) => setSetup((current) => ({ ...current, defaultLabelSize: event.target.value }))}
                      value={setup.defaultLabelSize}
                    >
                      <option value="4x6">4x6</option>
                      <option value="8.5x11">8.5x11</option>
                    </select>
                  </label>
                </div>
                <div className={styles.actionRow}>
                  <button
                    className={styles.secondaryButton}
                    disabled={saving}
                    onClick={() =>
                      savePatch({
                        defaultPackageWeightOz: normalizeInteger(setup.defaultPackageWeightOz),
                        defaultPackageLengthIn: normalizeNumber(setup.defaultPackageLengthIn),
                        defaultPackageWidthIn: normalizeNumber(setup.defaultPackageWidthIn),
                        defaultPackageHeightIn: normalizeNumber(setup.defaultPackageHeightIn),
                        defaultLabelFormat: setup.defaultLabelFormat || null,
                        defaultLabelSize: setup.defaultLabelSize || null,
                      })
                    }
                    type="button"
                  >
                    {saving ? 'Saving...' : 'Save step'}
                  </button>
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className={styles.configSection}>
                <div className={styles.sectionHeading}>
                  <h3>Manual fallback rates</h3>
                </div>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Domestic rate (USD)</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, shippingDomesticRate: event.target.value }))
                      }
                      value={setup.shippingDomesticRate}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>International rate (USD)</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, shippingInternationalRate: event.target.value }))
                      }
                      value={setup.shippingInternationalRate}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Free-shipping threshold (USD)</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, shippingThreshold: event.target.value }))
                      }
                      value={setup.shippingThreshold}
                    />
                  </label>
                </div>
                <div className={styles.actionRow}>
                  <button
                    className={styles.secondaryButton}
                    disabled={saving}
                    onClick={() =>
                      savePatch({
                        shippingDomesticRate: normalizeNumber(setup.shippingDomesticRate) ?? undefined,
                        shippingInternationalRate: normalizeNumber(setup.shippingInternationalRate) ?? undefined,
                        shippingThreshold: normalizeNumber(setup.shippingThreshold),
                      })
                    }
                    type="button"
                  >
                    {saving ? 'Saving...' : 'Save step'}
                  </button>
                </div>
              </section>
            ) : null}

            {step === 4 ? (
              <section className={styles.configSection}>
                <div className={styles.sectionHeading}>
                  <h3>Live provider</h3>
                </div>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Provider</span>
                    <select
                      className={styles.input}
                      onChange={(event) =>
                        setSetup((current) => ({ ...current, shippingLiveProvider: event.target.value }))
                      }
                      value={setup.shippingLiveProvider}
                    >
                      <option value="">Not selected</option>
                      <option value="EASYPOST">EasyPost</option>
                      <option value="SHIPPO">Shippo</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>API key</span>
                    <input
                      className={styles.input}
                      onChange={(event) => setProviderApiKey(event.target.value)}
                      placeholder={setup.shippingLiveProvider === 'SHIPPO' ? 'shippo_test_...' : 'ep_test_...'}
                      type="password"
                      value={providerApiKey}
                    />
                  </label>
                </div>
                <p className={styles.statusText}>Connected: {status?.providerConnected ? 'Yes' : 'No'}</p>
                <div className={styles.actionRow}>
                  <button
                    className={styles.secondaryButton}
                    disabled={saving}
                    onClick={() =>
                      savePatch({
                        shippingLiveProvider: setup.shippingLiveProvider || null,
                        shippingMode: setup.shippingMode,
                      })
                    }
                    type="button"
                  >
                    {saving ? 'Saving...' : 'Save step'}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    disabled={saving || !setup.shippingLiveProvider}
                    onClick={handleConnectProvider}
                    type="button"
                  >
                    {saving ? 'Saving...' : 'Connect provider'}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    disabled={providerTesting || !setup.shippingLiveProvider}
                    onClick={handleTestProvider}
                    type="button"
                  >
                    {providerTesting ? 'Testing...' : 'Test provider'}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    disabled={saving || !setup.shippingLiveProvider}
                    onClick={handleDisconnectProvider}
                    type="button"
                  >
                    {saving ? 'Saving...' : 'Disconnect provider'}
                  </button>
                </div>
                {providerResult ? (
                  <div className={styles.statusBlock}>
                    <p className={styles.statusTitle}>
                      {providerResult.ok ? 'Connection successful' : 'Connection failed'}
                    </p>
                    <p className={styles.statusText}>{providerResult.message}</p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {step === 5 ? (
              <section className={styles.configSection}>
                <div className={styles.sectionHeading}>
                  <h3>Test rates</h3>
                </div>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Subtotal (USD)</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setTestInput((current) => ({ ...current, subtotal: event.target.value }))
                      }
                      value={testInput.subtotal}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Destination country</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setTestInput((current) => ({ ...current, destinationCountry: event.target.value }))
                      }
                      value={testInput.destinationCountry}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Destination province</span>
                    <input
                      className={styles.input}
                      onChange={(event) =>
                        setTestInput((current) => ({ ...current, destinationProvince: event.target.value }))
                      }
                      value={testInput.destinationProvince}
                    />
                  </label>
                </div>
                <div className={styles.actionRow}>
                  <button className={styles.secondaryButton} disabled={testing} onClick={handleTestRates} type="button">
                    {testing ? 'Testing...' : 'Run test'}
                  </button>
                </div>
                {testQuotes.length ? (
                  <div className={styles.statusBlock}>
                    <p className={styles.statusTitle}>Top quote: ${Number(testQuotes[0]?.amount ?? 0).toFixed(2)}</p>
                    <p className={styles.statusText}>{testQuotes[0]?.displayName}</p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {step === 6 ? (
              <section className={styles.configSection}>
                <div className={styles.sectionHeading}>
                  <h3>Setup summary</h3>
                </div>
                <div className={styles.statusBlock}>
                  {summaryLines.map((line) => (
                    <p className={styles.statusText} key={line}>
                      {line}
                    </p>
                  ))}
                </div>
                <div className={styles.formGrid}>
                  <div>
                    <p className={styles.statusTitle}>Warnings</p>
                    {(status?.warnings || []).length ? (
                      <ul className={styles.setupList}>
                        {status.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.statusText}>No warnings.</p>
                    )}
                  </div>
                  <div>
                    <p className={styles.statusTitle}>Next steps</p>
                    {(status?.nextSteps || []).length ? (
                      <ul className={styles.setupList}>
                        {status.nextSteps.map((nextStep) => (
                          <li key={nextStep}>{nextStep}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.statusText}>No follow-up actions.</p>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            <div className={styles.actionRow}>
              <button className={styles.secondaryButton} disabled={step === 0} onClick={prevStep} type="button">
                Previous
              </button>
              <button
                className={styles.secondaryButton}
                disabled={step === STEPS.length - 1}
                onClick={nextStep}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
