"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../AppShell';
import { useSettings } from '../../context/SettingsContext';
import styles from './SettingsWorkspace.module.css';
import IntegrationsPanel from './IntegrationsPanel';
import AdminButton from '../admin/ui/AdminButton';
import AdminCard from '../admin/ui/AdminCard';
import AdminFormSection from '../admin/ui/AdminFormSection';
import AdminLiveStatus from '../admin/ui/AdminLiveStatus';
import AdminSelect from '../admin/ui/AdminSelect';
import AdminSavedState from '../admin/ui/AdminSavedState';
import AdminStatusChip from '../admin/ui/AdminStatusChip';
import AdminTooltip from '../admin/ui/AdminTooltip';
import { BRAND_FONT_VALUES, BUTTON_RADIUS_VALUES, BUTTON_STYLE_VALUES, BUTTON_TEXT_TRANSFORM_VALUES } from '@/lib/brand-kit';
import { buildCheckoutPricingWithDecisionsCents } from '@/server/checkout/pricing';

const SETTINGS_SECTIONS = [
  { id: 'brand-kit', label: 'Brand kit' },
  { id: 'payments', label: 'Payments' },
  { id: 'shipping', label: 'Shipping & tax' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'email', label: 'Email' },
  { id: 'setup', label: 'Setup' },
];

const SETUP_STATUS_PRIORITY = {
  PASS: 0,
  WARN: 1,
  FAIL: 2,
};

const SETUP_CARD_DEFINITIONS = [
  { id: 'database', label: 'Database reachable', checkIds: ['database-url', 'database-reachable', 'prisma-client-generated'] },
  { id: 'store', label: 'Store seeded', checkIds: ['store-exists', 'store-settings'] },
  { id: 'owner', label: 'Owner account exists', checkIds: ['owner-user-exists'] },
  { id: 'stripe-core', label: 'Stripe env keys found', checkIds: ['stripe-keys'] },
  { id: 'stripe-webhook', label: 'Stripe webhook secret found', checkIds: ['stripe-webhook-secret'] },
  { id: 'email-provider', label: 'Email API key found', checkIds: ['resend-api-or-preview'] },
  { id: 'email-webhook', label: 'Email webhook secret found', checkIds: ['resend-webhook-secret-enabled'] },
  { id: 'webhook-retry', label: 'Webhook retry secret found', checkIds: ['webhook-retry-secret'] },
  { id: 'public-url', label: 'Public store URL set', checkIds: ['next-public-store-url'] },
  { id: 'deployment', label: 'Deployment env detected', checkIds: ['vercel-deployment'] },
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

const SETUP_ENV_TEMPLATE = [
  '# Doopify setup template',
  'DATABASE_URL=',
  'JWT_SECRET="generate-a-random-32-character-secret"',
  'STRIPE_SECRET_KEY=',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=',
  'STRIPE_WEBHOOK_SECRET=',
  'WEBHOOK_RETRY_SECRET="generate-a-random-32-character-secret"',
  'RESEND_API_KEY=',
  'RESEND_WEBHOOK_SECRET=',
  'NEXT_PUBLIC_STORE_URL=',
].join('\n');

const SETUP_PROVIDER_VERIFICATION_PLACEHOLDERS = [
  'Verify Stripe API connection — coming soon',
  'Verify Resend API connection — coming soon',
  'Verify webhook endpoint — coming soon',
];

const FONT_OPTIONS = BRAND_FONT_VALUES.map((value) => ({ value, label: value }));
const BUTTON_RADIUS_OPTIONS = BUTTON_RADIUS_VALUES.map((value) => ({ value, label: value }));
const BUTTON_STYLE_OPTIONS = BUTTON_STYLE_VALUES.map((value) => ({ value, label: value }));
const BUTTON_TEXT_TRANSFORM_OPTIONS = BUTTON_TEXT_TRANSFORM_VALUES.map((value) => ({ value, label: value }));

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

const EMPTY_TAX_SETTINGS = {
  enabled: false,
  strategy: 'NONE',
  defaultTaxRatePercent: '0',
  taxShipping: false,
  pricesIncludeTax: false,
  originCountry: '',
  originState: '',
  originPostalCode: '',
};

const EMPTY_SHIPPING_TAX_PREVIEW = {
  subtotal: '75',
  country: 'US',
  province: '',
  selectedRateId: '',
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
  const [activeSection, setActiveSection] = useState('brand-kit');
  const { settings, updateSettings, loading, error } = useSettings();
  const [shippingConfigLoading, setShippingConfigLoading] = useState(false);
  const [shippingConfigError, setShippingConfigError] = useState('');
  const [shippingConfigLoaded, setShippingConfigLoaded] = useState(false);
  const [shippingZones, setShippingZones] = useState([]);
  const [taxRules, setTaxRules] = useState([]);
  const [taxSettings, setTaxSettings] = useState(EMPTY_TAX_SETTINGS);
  const [taxSettingsSaving, setTaxSettingsSaving] = useState(false);
  const [shippingTaxPreview, setShippingTaxPreview] = useState(EMPTY_SHIPPING_TAX_PREVIEW);
  const [newZone, setNewZone] = useState(EMPTY_ZONE_FORM);
  const [newTaxRule, setNewTaxRule] = useState(EMPTY_TAX_FORM);
  const [newRateByZoneId, setNewRateByZoneId] = useState({});
  const [setupStatus, setSetupStatus] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupLoaded, setSetupLoaded] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupCopiedCommandId, setSetupCopiedCommandId] = useState('');
  const [savedState, setSavedState] = useState('saved');
  const [lastSavedAt, setLastSavedAt] = useState(Date.now());
  const [saveClock, setSaveClock] = useState(Date.now());
  const [brandKit, setBrandKit] = useState(null);
  const [brandKitLoading, setBrandKitLoading] = useState(false);
  const [brandKitError, setBrandKitError] = useState('');
  const [brandKitNotice, setBrandKitNotice] = useState('');
  const [showAdvancedUrls, setShowAdvancedUrls] = useState(false);
  const [uploadingField, setUploadingField] = useState('');
  const logoUploadRef = useRef(null);
  const faviconUploadRef = useRef(null);
  const emailLogoUploadRef = useRef(null);
  const checkoutLogoUploadRef = useRef(null);

  const activeTitle = useMemo(
    () => SETTINGS_SECTIONS.find((section) => section.id === activeSection)?.label || 'Settings',
    [activeSection]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section && SETTINGS_SECTIONS.some((entry) => entry.id === section)) {
      setActiveSection(section);
    }
  }, []);

  useEffect(() => {
    if (activeSection !== 'brand-kit' || brandKit || brandKitLoading) {
      return;
    }

    let cancelled = false;

    async function loadBrandKit() {
      setBrandKitLoading(true);
      setBrandKitError('');
      try {
        const data = await fetch('/api/settings/brand-kit', { cache: 'no-store' }).then(parseApiJson);
        if (!cancelled) {
          setBrandKit(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setBrandKitError(loadError instanceof Error ? loadError.message : 'Failed to load brand kit');
        }
      } finally {
        if (!cancelled) {
          setBrandKitLoading(false);
        }
      }
    }

    loadBrandKit();

    return () => {
      cancelled = true;
    };
  }, [activeSection, brandKit, brandKitLoading]);

  useEffect(() => {
    if (activeSection !== 'shipping' || shippingConfigLoaded || shippingConfigLoading) {
      return;
    }

    let cancelled = false;

    async function loadShippingConfig() {
      setShippingConfigLoading(true);
      setShippingConfigError('');
      try {
        const [zonesData, taxRulesData, taxSettingsData] = await Promise.all([
          fetch('/api/settings/shipping-zones').then(parseApiJson),
          fetch('/api/settings/tax-rules').then(parseApiJson),
          fetch('/api/settings/tax', { cache: 'no-store' }).then(parseApiJson),
        ]);

        if (cancelled) return;
        setShippingZones((zonesData || []).map(toZoneForm));
        setTaxRules((taxRulesData || []).map(toTaxForm));
        setTaxSettings({
          enabled: Boolean(taxSettingsData?.enabled),
          strategy: taxSettingsData?.strategy || 'NONE',
          defaultTaxRatePercent: String(Number(taxSettingsData?.defaultTaxRatePercent ?? 0)),
          taxShipping: Boolean(taxSettingsData?.taxShipping),
          pricesIncludeTax: Boolean(taxSettingsData?.pricesIncludeTax),
          originCountry: taxSettingsData?.originCountry || '',
          originState: taxSettingsData?.originState || '',
          originPostalCode: taxSettingsData?.originPostalCode || '',
        });
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
    if (activeSection !== 'setup' || setupLoaded) {
      return;
    }

    let cancelled = false;

    async function loadSetupStatus() {
      setSetupLoading(true);
      setSetupError('');

      try {
        const diagnostics = await fetch('/api/setup/status', { cache: 'no-store' }).then(parseApiJson);
        if (!cancelled) {
          setSetupStatus(diagnostics);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSetupStatus(null);
          setSetupError(loadError instanceof Error ? loadError.message : 'Failed to load setup diagnostics');
        }
      } finally {
        setSetupLoading(false);
        setSetupLoaded(true);
      }
    }

    loadSetupStatus();

    return () => {
      cancelled = true;
    };
  }, [activeSection, setupLoaded]);

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
  const hasSetupDiagnostics = Boolean(setupStatus && Array.isArray(setupStatus.requiredChecks));
  const setupCompletionPercent = setupStatus?.completionPercent ?? 0;
  const showSetupLoadingState = activeSection === 'setup' && setupLoading && !setupStatus && !setupError;
  const showSetupErrorState = activeSection === 'setup' && Boolean(setupError);
  const showSetupDiagnostics = activeSection === 'setup' && hasSetupDiagnostics;
  const setupRequiredNextSteps = setupStatus?.requiredNextSteps || [];
  const setupProviderSetupSteps = setupStatus?.providerSetupSteps || [];
  const setupOptionalProductionSteps = setupStatus?.optionalProductionSteps || [];

  useEffect(() => {
    const timer = window.setInterval(() => setSaveClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const savedAgoText = useMemo(() => {
    const elapsedSeconds = Math.max(1, Math.round((saveClock - lastSavedAt) / 1000));
    if (elapsedSeconds < 60) {
      return `${elapsedSeconds}s ago`;
    }

    const elapsedMinutes = Math.round(elapsedSeconds / 60);
    return `${elapsedMinutes}m ago`;
  }, [lastSavedAt, saveClock]);

  async function handleSettingsPatch(patch) {
    setSavedState('saving');

    try {
      await updateSettings(patch);
      setSavedState('saved');
      setLastSavedAt(Date.now());
    } catch {
      setSavedState('error');
    }
  }

  function handleBrandKitPatch(patch) {
    setBrandKit((current) => ({ ...(current || {}), ...patch }));
    setSavedState('dirty');
  }

  async function handleBrandKitSave() {
    if (!brandKit) return;
    setSavedState('saving');
    setBrandKitError('');
    try {
      const updated = await fetch('/api/settings/brand-kit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandKit),
      }).then(parseApiJson);
      setBrandKit(updated);
      setSavedState('saved');
      setLastSavedAt(Date.now());
    } catch (saveError) {
      setSavedState('error');
      setBrandKitError(saveError instanceof Error ? saveError.message : 'Failed to save brand kit');
    }
  }

  async function handleBrandAssetUpload(field, file) {
    if (!file) return;
    setUploadingField(field);
    setBrandKitError('');
    setBrandKitNotice('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('altText', file.name);
      const uploaded = await fetch('/api/media/upload', { method: 'POST', body: form }).then(parseApiJson);
      const assetUrl = uploaded?.url || '';
      if (!assetUrl) {
        throw new Error('Upload succeeded but no asset URL was returned.');
      }
      handleBrandKitPatch({ [field]: assetUrl });
      setBrandKitNotice('Asset uploaded. Save changes to persist it in Brand Kit.');
    } catch (uploadError) {
      setBrandKitError(uploadError instanceof Error ? uploadError.message : 'Brand asset upload failed.');
    } finally {
      setUploadingField('');
    }
  }

  function renderAssetUploadField({ field, label, refObject }) {
    const currentValue = brandKit?.[field] || '';
    return (
      <div className={styles.assetField}>
        <div className={styles.assetFieldHeader}>
          <span>{label}</span>
          <div className={styles.assetActions}>
            <input
              accept="image/*"
              className={styles.hiddenFileInput}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleBrandAssetUpload(field, file);
                }
                event.target.value = '';
              }}
              ref={refObject}
              type="file"
            />
            <AdminButton
              disabled={uploadingField === field}
              onClick={() => refObject.current?.click()}
              size="sm"
              variant="secondary"
            >
              {uploadingField === field ? 'Uploading...' : currentValue ? 'Replace file' : 'Upload file'}
            </AdminButton>
            {currentValue ? (
              <AdminButton onClick={() => handleBrandKitPatch({ [field]: '' })} size="sm" variant="ghost">
                Clear
              </AdminButton>
            ) : null}
          </div>
        </div>
        {currentValue ? (
          <div className={styles.assetPreview}>
            <img alt={`${label} preview`} src={currentValue} />
          </div>
        ) : (
          <p className={styles.assetHint}>No file selected yet.</p>
        )}
      </div>
    );
  }

  async function refreshShippingConfig() {
    setShippingConfigLoaded(false);
    setShippingConfigLoading(false);
    setShippingConfigError('');
    const [zonesData, taxRulesData, taxSettingsData] = await Promise.all([
      fetch('/api/settings/shipping-zones').then(parseApiJson),
      fetch('/api/settings/tax-rules').then(parseApiJson),
      fetch('/api/settings/tax', { cache: 'no-store' }).then(parseApiJson),
    ]);
    setShippingZones((zonesData || []).map(toZoneForm));
    setTaxRules((taxRulesData || []).map(toTaxForm));
    setTaxSettings({
      enabled: Boolean(taxSettingsData?.enabled),
      strategy: taxSettingsData?.strategy || 'NONE',
      defaultTaxRatePercent: String(Number(taxSettingsData?.defaultTaxRatePercent ?? 0)),
      taxShipping: Boolean(taxSettingsData?.taxShipping),
      pricesIncludeTax: Boolean(taxSettingsData?.pricesIncludeTax),
      originCountry: taxSettingsData?.originCountry || '',
      originState: taxSettingsData?.originState || '',
      originPostalCode: taxSettingsData?.originPostalCode || '',
    });
    setShippingConfigLoaded(true);
  }

  const shippingTaxPreviewPricing = useMemo(() => {
    const subtotalDollars = parseNumberOrUndefined(shippingTaxPreview.subtotal) ?? 0;
    const subtotalCents = Math.max(0, Math.round(subtotalDollars * 100));
    const shippingThresholdDollars = parseNumberOrUndefined(settings.freeShippingThreshold);
    const shippingThresholdCents =
      shippingThresholdDollars == null ? null : Math.max(0, Math.round(shippingThresholdDollars * 100));
    const domesticCents = Math.max(0, Math.round((parseNumberOrUndefined(settings.domesticShippingRate) ?? 0) * 100));
    const internationalCents = Math.max(
      0,
      Math.round((parseNumberOrUndefined(settings.internationalShippingRate) ?? 0) * 100)
    );
    const defaultTaxRateBps = Math.max(
      0,
      Math.round((parseNumberOrUndefined(taxSettings.defaultTaxRatePercent) ?? 0) * 100)
    );

    return buildCheckoutPricingWithDecisionsCents(
      [{ priceCents: subtotalCents, quantity: 1 }],
      shippingThresholdCents,
      {
        shippingAddress: {
          country: shippingTaxPreview.country,
          province: shippingTaxPreview.province,
        },
        storeCountry: taxSettings.originCountry || settings.taxOriginCountry || 'US',
        shippingRates: {
          domesticCents,
          internationalCents,
        },
        shippingZones: shippingZones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          countryCode: zone.countryCode,
          provinceCode: zone.provinceCode || null,
          isActive: zone.isActive,
          priority: parseNumberOrUndefined(zone.priority) ?? 100,
          rates: zone.rates.map((rate) => ({
            id: rate.id,
            name: rate.name,
            method: rate.method,
            amountCents: Math.max(0, Math.round((parseNumberOrUndefined(rate.amount) ?? 0) * 100)),
            minSubtotalCents:
              rate.minSubtotal === '' ? null : Math.max(0, Math.round((parseNumberOrUndefined(rate.minSubtotal) ?? 0) * 100)),
            maxSubtotalCents:
              rate.maxSubtotal === '' ? null : Math.max(0, Math.round((parseNumberOrUndefined(rate.maxSubtotal) ?? 0) * 100)),
            isActive: rate.isActive,
            priority: parseNumberOrUndefined(rate.priority) ?? 100,
          })),
        })),
        taxSettings: {
          enabled: taxSettings.enabled,
          strategy: taxSettings.strategy,
          defaultTaxRateBps,
          taxShipping: taxSettings.taxShipping,
          pricesIncludeTax: taxSettings.pricesIncludeTax,
        },
        selectedShippingRateId: shippingTaxPreview.selectedRateId || undefined,
      }
    );
  }, [settings, shippingTaxPreview, shippingZones, taxSettings]);

  async function handleSaveTaxSettings() {
    const ratePercent = parseNumberOrUndefined(taxSettings.defaultTaxRatePercent);
    if (ratePercent == null || ratePercent < 0 || ratePercent > 100) {
      setShippingConfigError('Manual tax rate must be between 0 and 100%.');
      return;
    }

    try {
      setShippingConfigError('');
      setTaxSettingsSaving(true);
      const updated = await fetch('/api/settings/tax', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: taxSettings.enabled,
          strategy: taxSettings.strategy,
          defaultTaxRatePercent: ratePercent,
          taxShipping: taxSettings.taxShipping,
          pricesIncludeTax: taxSettings.pricesIncludeTax,
          originCountry: taxSettings.originCountry || null,
          originState: taxSettings.originState || null,
          originPostalCode: taxSettings.originPostalCode || null,
        }),
      }).then(parseApiJson);

      setTaxSettings({
        enabled: Boolean(updated?.enabled),
        strategy: updated?.strategy || 'NONE',
        defaultTaxRatePercent: String(Number(updated?.defaultTaxRatePercent ?? 0)),
        taxShipping: Boolean(updated?.taxShipping),
        pricesIncludeTax: Boolean(updated?.pricesIncludeTax),
        originCountry: updated?.originCountry || '',
        originState: updated?.originState || '',
        originPostalCode: updated?.originPostalCode || '',
      });
    } catch (saveError) {
      setShippingConfigError(saveError instanceof Error ? saveError.message : 'Failed to save tax settings');
    } finally {
      setTaxSettingsSaving(false);
    }
  }

  async function refreshSetupStatus() {
    try {
      setSetupLoading(true);
      setSetupError('');
      const diagnostics = await fetch('/api/setup/status', { cache: 'no-store' }).then(parseApiJson);
      setSetupStatus(diagnostics);
    } catch (refreshError) {
      setSetupStatus(null);
      setSetupError(refreshError instanceof Error ? refreshError.message : 'Failed to refresh setup diagnostics');
    } finally {
      setSetupLoading(false);
      setSetupLoaded(true);
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
        <div className={`${styles.navPanel} glass-card refraction-edge admin-spotlight`}>
          <div className={styles.navHeader}>
            <p className={styles.eyebrow}>Settings</p>
            <h2 className={styles.title}>Brand controls</h2>
          </div>
          <div className={styles.sectionList}>
            {SETTINGS_SECTIONS.map((section) => (
              <AdminButton
                key={section.id}
                className={activeSection === section.id ? styles.sectionButtonActive : styles.sectionButton}
                disabled={loading}
                onClick={() => setActiveSection(section.id)}
                size="sm"
                variant={activeSection === section.id ? 'primary' : 'secondary'}
              >
                {section.label}
              </AdminButton>
            ))}
          </div>
        </div>

        <div className={styles.detailPanel}>
          <div aria-busy={loading || shippingConfigLoading || setupLoading} className={`${styles.detailCard} glass-card refraction-edge admin-spotlight`}>
            <div className={styles.detailHeader}>
              <div>
                <p className={styles.eyebrow}>Settings</p>
                <h2 className={styles.title}>{activeTitle}</h2>
              </div>
              {activeSection === 'setup' ? (
                <AdminButton disabled={setupLoading} onClick={() => refreshSetupStatus()} size="sm" variant="secondary">
                  {setupLoading ? 'Refreshing...' : 'Refresh diagnostics'}
                </AdminButton>
              ) : (
                <div className={styles.headerActions}>
                  <AdminSavedState savedAgoText={savedAgoText} state={savedState} />
                  <AdminButton
                    disabled={loading || Boolean(error) || (activeSection === 'brand-kit' && (brandKitLoading || !brandKit))}
                    onClick={activeSection === 'brand-kit' ? handleBrandKitSave : undefined}
                    size="sm"
                    variant="primary"
                  >
                    Save changes
                  </AdminButton>
                </div>
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

            {!loading && !error && activeSection === 'brand-kit' ? (
              <div className={styles.brandKitLayout}>
                <div className={styles.brandKitHeading}>
                  <h3>Brand Kit</h3>
                  <p>Manage branding used by storefront, checkout, and customer emails.</p>
                </div>

                <AdminFormSection
                  description=""
                  eyebrow="Identity"
                  title={<span className={styles.sectionTitleWithHelp}>Brand identity<AdminTooltip content="Core brand values consumed by storefront pages, checkout, and emails." /></span>}
                >
                  <div className={styles.brandFieldGrid}>
                    <label className={styles.field}>
                      <span>Brand name</span>
                      <input className={styles.input} onChange={(event) => handleBrandKitPatch({ name: event.target.value })} value={brandKit?.name || ''} />
                    </label>
                    <label className={styles.field}>
                      <span>Support email</span>
                      <input className={styles.input} onChange={(event) => handleBrandKitPatch({ supportEmail: event.target.value })} value={brandKit?.supportEmail || ''} />
                    </label>
                  </div>
                  <div className={styles.brandFieldGrid}>
                    {renderAssetUploadField({ field: 'logoUrl', label: 'Store logo', refObject: logoUploadRef })}
                    {renderAssetUploadField({ field: 'faviconUrl', label: 'Favicon', refObject: faviconUploadRef })}
                  </div>
                  <AdminButton className={styles.advancedToggle} onClick={() => setShowAdvancedUrls((current) => !current)} size="sm" variant="secondary">
                    {showAdvancedUrls ? 'Hide URL fallback' : 'Use URL fallback instead'}
                  </AdminButton>
                  {showAdvancedUrls ? (
                    <div className={styles.brandFieldGrid}>
                      <label className={styles.field}>
                        <span>Store logo URL</span>
                        <input className={styles.input} onChange={(event) => handleBrandKitPatch({ logoUrl: event.target.value })} value={brandKit?.logoUrl || ''} />
                      </label>
                      <label className={styles.field}>
                        <span>Favicon URL</span>
                        <input className={styles.input} onChange={(event) => handleBrandKitPatch({ faviconUrl: event.target.value })} value={brandKit?.faviconUrl || ''} />
                      </label>
                    </div>
                  ) : null}
                </AdminFormSection>

                <AdminFormSection
                  description=""
                  eyebrow="Visual"
                  title={<span className={styles.sectionTitleWithHelp}>Colors<AdminTooltip content="Storefront and checkout color tokens." /></span>}
                >
                  <div className={styles.brandFieldGrid}>
                    <label className={styles.field}><span>Primary color</span><input className={styles.input} onChange={(event) => handleBrandKitPatch({ primaryColor: event.target.value })} value={brandKit?.primaryColor || ''} /></label>
                    <label className={styles.field}><span>Secondary color</span><input className={styles.input} onChange={(event) => handleBrandKitPatch({ secondaryColor: event.target.value })} value={brandKit?.secondaryColor || ''} /></label>
                    <label className={styles.field}><span>Accent color</span><input className={styles.input} onChange={(event) => handleBrandKitPatch({ accentColor: event.target.value })} value={brandKit?.accentColor || ''} /></label>
                    <label className={styles.field}><span>Text color</span><input className={styles.input} onChange={(event) => handleBrandKitPatch({ textColor: event.target.value })} value={brandKit?.textColor || ''} /></label>
                  </div>
                </AdminFormSection>

                <AdminFormSection
                  description=""
                  eyebrow="Typography"
                  title={<span className={styles.sectionTitleWithHelp}>Typography and buttons<AdminTooltip content="Used in storefront and checkout where these tokens are supported." /></span>}
                >
                  <div className={styles.brandFieldGrid}>
                    <label className={styles.field}>
                      <span>Heading font</span>
                      <AdminSelect onChange={(nextValue) => handleBrandKitPatch({ headingFont: nextValue })} options={FONT_OPTIONS} value={brandKit?.headingFont || 'system'} />
                    </label>
                    <label className={styles.field}>
                      <span>Body font</span>
                      <AdminSelect onChange={(nextValue) => handleBrandKitPatch({ bodyFont: nextValue })} options={FONT_OPTIONS} value={brandKit?.bodyFont || 'system'} />
                    </label>
                    <label className={styles.field}>
                      <span>Button radius</span>
                      <AdminSelect onChange={(nextValue) => handleBrandKitPatch({ buttonRadius: nextValue })} options={BUTTON_RADIUS_OPTIONS} value={brandKit?.buttonRadius || 'md'} />
                    </label>
                    <label className={styles.field}>
                      <span>Button style</span>
                      <AdminSelect onChange={(nextValue) => handleBrandKitPatch({ buttonStyle: nextValue })} options={BUTTON_STYLE_OPTIONS} value={brandKit?.buttonStyle || 'solid'} />
                    </label>
                    <label className={styles.field}>
                      <span>Button text transform</span>
                      <AdminSelect onChange={(nextValue) => handleBrandKitPatch({ buttonTextTransform: nextValue })} options={BUTTON_TEXT_TRANSFORM_OPTIONS} value={brandKit?.buttonTextTransform || 'normal'} />
                    </label>
                  </div>
                </AdminFormSection>

                <AdminFormSection
                  description=""
                  eyebrow="Email"
                  title={<span className={styles.sectionTitleWithHelp}>Email branding<AdminTooltip content="Used in transactional email templates for logo, header tint, and footer copy." /></span>}
                >
                  <div className={styles.brandFieldGrid}>
                    {renderAssetUploadField({ field: 'emailLogoUrl', label: 'Email logo', refObject: emailLogoUploadRef })}
                    {renderAssetUploadField({ field: 'checkoutLogoUrl', label: 'Checkout logo', refObject: checkoutLogoUploadRef })}
                    <label className={styles.field}>
                      <span>Email header color</span>
                      <input className={styles.input} onChange={(event) => handleBrandKitPatch({ emailHeaderColor: event.target.value })} value={brandKit?.emailHeaderColor || ''} />
                    </label>
                    <label className={styles.field}>
                      <span>Email footer text</span>
                      <input className={styles.input} onChange={(event) => handleBrandKitPatch({ emailFooterText: event.target.value })} value={brandKit?.emailFooterText || ''} />
                    </label>
                  </div>
                </AdminFormSection>

                <AdminFormSection
                  description=""
                  eyebrow="Social"
                  title={<span className={styles.sectionTitleWithHelp}>Social links<AdminTooltip content="Exposed by storefront settings for social destinations." /></span>}
                >
                  <div className={styles.brandFieldGrid}>
                    <label className={styles.field}><span>Instagram URL</span><input className={styles.input} onChange={(event) => handleBrandKitPatch({ instagramUrl: event.target.value })} value={brandKit?.instagramUrl || ''} /></label>
                    <label className={styles.field}><span>Facebook URL</span><input className={styles.input} onChange={(event) => handleBrandKitPatch({ facebookUrl: event.target.value })} value={brandKit?.facebookUrl || ''} /></label>
                    <label className={styles.field}><span>TikTok URL</span><input className={styles.input} onChange={(event) => handleBrandKitPatch({ tiktokUrl: event.target.value })} value={brandKit?.tiktokUrl || ''} /></label>
                    <label className={styles.field}><span>YouTube URL</span><input className={styles.input} onChange={(event) => handleBrandKitPatch({ youtubeUrl: event.target.value })} value={brandKit?.youtubeUrl || ''} /></label>
                  </div>
                </AdminFormSection>

                {brandKitNotice ? (
                  <div className={styles.statusBlock}>
                    <p className={styles.statusText}>{brandKitNotice}</p>
                  </div>
                ) : null}
                {brandKitLoading ? <p className={styles.statusText}>Loading Brand Kit...</p> : null}
                {brandKitError ? (
                  <div className={styles.statusBlock}>
                    <p className={styles.statusTitle}>Brand Kit error</p>
                    <p className={styles.statusText}>{brandKitError}</p>
                  </div>
                ) : null}
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
                </div>

                {shippingConfigLoading ? (
                  <p className={styles.statusText}>Loading shipping zones and tax rules...</p>
                ) : null}

                {shippingConfigError ? (
                  <div className={styles.statusBlock}>
                    <p className={styles.statusTitle}>Shipping configuration error</p>
                    <p className={styles.statusText}>{shippingConfigError}</p>
                    <AdminButton onClick={() => refreshShippingConfig()} size="sm" variant="secondary">
                      Retry
                    </AdminButton>
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
                    <AdminButton onClick={handleCreateZone} size="sm" variant="secondary">
                      Add zone
                    </AdminButton>
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
                        <AdminButton onClick={() => handleSaveZone(zone)} size="sm" variant="secondary">
                          Save zone
                        </AdminButton>
                        <AdminButton onClick={() => handleDeleteZone(zone.id)} size="sm" variant="danger">
                          Delete zone
                        </AdminButton>
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
                              <AdminButton onClick={() => handleSaveRate(zone.id, rate)} size="sm" variant="secondary">
                                Save rate
                              </AdminButton>
                              <AdminButton onClick={() => handleDeleteRate(zone.id, rate.id)} size="sm" variant="danger">
                                Delete rate
                              </AdminButton>
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
                        <AdminButton onClick={() => handleCreateRate(zone.id)} size="sm" variant="secondary">
                          Add rate
                        </AdminButton>
                      </div>
                    </div>
                  ))}
                </section>

                <section className={styles.configSection}>
                  <div className={styles.sectionHeading}>
                    <h3>Tax settings (manual)</h3>
                  </div>

                  <div className={styles.inlineGrid}>
                    <label className={styles.checkboxField}>
                      <input
                        checked={taxSettings.enabled}
                        onChange={(event) =>
                          setTaxSettings((current) => ({ ...current, enabled: event.target.checked }))
                        }
                        type="checkbox"
                      />
                      <span>Enable tax collection</span>
                    </label>
                    <label className={styles.field}>
                      <span>Strategy</span>
                      <select
                        className={styles.input}
                        onChange={(event) =>
                          setTaxSettings((current) => ({ ...current, strategy: event.target.value }))
                        }
                        value={taxSettings.strategy}
                      >
                        <option value="NONE">No tax</option>
                        <option value="MANUAL">Manual</option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Manual tax rate (%)</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setTaxSettings((current) => ({
                            ...current,
                            defaultTaxRatePercent: event.target.value,
                          }))
                        }
                        value={taxSettings.defaultTaxRatePercent}
                      />
                    </label>
                    <label className={styles.checkboxField}>
                      <input
                        checked={taxSettings.taxShipping}
                        onChange={(event) =>
                          setTaxSettings((current) => ({ ...current, taxShipping: event.target.checked }))
                        }
                        type="checkbox"
                      />
                      <span>Tax shipping</span>
                    </label>
                    <label className={styles.checkboxField}>
                      <input
                        checked={taxSettings.pricesIncludeTax}
                        onChange={(event) =>
                          setTaxSettings((current) => ({ ...current, pricesIncludeTax: event.target.checked }))
                        }
                        type="checkbox"
                      />
                      <span>Prices include tax</span>
                    </label>
                    <label className={styles.field}>
                      <span>Origin country</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setTaxSettings((current) => ({ ...current, originCountry: event.target.value }))
                        }
                        value={taxSettings.originCountry}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Origin state</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setTaxSettings((current) => ({ ...current, originState: event.target.value }))
                        }
                        value={taxSettings.originState}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Origin postal code</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setTaxSettings((current) => ({ ...current, originPostalCode: event.target.value }))
                        }
                        value={taxSettings.originPostalCode}
                      />
                    </label>
                    <AdminButton disabled={taxSettingsSaving} onClick={handleSaveTaxSettings} size="sm" variant="secondary">
                      {taxSettingsSaving ? 'Saving tax settings...' : 'Save tax settings'}
                    </AdminButton>
                  </div>
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
                    <AdminButton onClick={handleCreateTaxRule} size="sm" variant="secondary">
                      Add tax rule
                    </AdminButton>
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
                        <AdminButton onClick={() => handleSaveTaxRule(rule)} size="sm" variant="secondary">
                          Save tax rule
                        </AdminButton>
                        <AdminButton onClick={() => handleDeleteTaxRule(rule.id)} size="sm" variant="danger">
                          Delete tax rule
                        </AdminButton>
                      </div>
                    </div>
                  ))}
                </section>

                <section className={styles.configSection}>
                  <div className={styles.sectionHeading}>
                    <h3>Calculation preview</h3>
                  </div>

                  <div className={styles.inlineGrid}>
                    <label className={styles.field}>
                      <span>Subtotal (USD)</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setShippingTaxPreview((current) => ({ ...current, subtotal: event.target.value }))
                        }
                        value={shippingTaxPreview.subtotal}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Destination country</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setShippingTaxPreview((current) => ({ ...current, country: event.target.value }))
                        }
                        value={shippingTaxPreview.country}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Destination state/province</span>
                      <input
                        className={styles.input}
                        onChange={(event) =>
                          setShippingTaxPreview((current) => ({ ...current, province: event.target.value }))
                        }
                        value={shippingTaxPreview.province}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Shipping rate</span>
                      <select
                        className={styles.input}
                        onChange={(event) =>
                          setShippingTaxPreview((current) => ({
                            ...current,
                            selectedRateId: event.target.value,
                          }))
                        }
                        value={shippingTaxPreview.selectedRateId}
                      >
                        <option value="">Auto-select best rate</option>
                        {(shippingTaxPreviewPricing.shippingDecision?.availableRates || []).map((rate) => (
                          <option key={rate.id} value={rate.id}>
                            {rate.label} (${(rate.amountCents / 100).toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className={styles.statusBlock}>
                    <p className={styles.statusTitle}>
                      Subtotal ${((shippingTaxPreviewPricing.subtotalCents || 0) / 100).toFixed(2)} • Shipping $
                      {((shippingTaxPreviewPricing.shippingAmountCents || 0) / 100).toFixed(2)} • Tax $
                      {((shippingTaxPreviewPricing.taxAmountCents || 0) / 100).toFixed(2)}
                    </p>
                    <p className={styles.statusText}>
                      Total: ${((shippingTaxPreviewPricing.totalCents || 0) / 100).toFixed(2)}
                    </p>
                    <p className={styles.statusText}>
                      Shipping source: {shippingTaxPreviewPricing.shippingDecision?.source || 'none'} | Tax source:{' '}
                      {shippingTaxPreviewPricing.taxDecision?.source || 'none'}
                    </p>
                    {shippingTaxPreviewPricing.shippingDecision?.warning ? (
                      <p className={styles.statusText}>{shippingTaxPreviewPricing.shippingDecision.warning}</p>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}

            {!loading && !error && activeSection === 'payments' ? (
              <div className={styles.infoBlock}>Set payment providers, capture mode, manual payment methods, and refund rules here next.</div>
            ) : null}

            {!loading && !error && activeSection === 'email' ? (
              <div className={styles.brandKitLayout}>
                <AdminCard className={styles.brandRow} spotlight variant="inset">
                  <div className={styles.rowMeta}>
                    <h4>Email delivery profile</h4>
                    <p>Keep sender identity aligned with store branding while observability handles retries and provider health.</p>
                  </div>
                  <div className={styles.rowInputs}>
                    <label className={styles.field}>
                      <span>Sender email</span>
                      <input className={styles.input} onChange={(event) => handleSettingsPatch({ senderEmail: event.target.value })} value={settings.senderEmail} />
                    </label>
                  </div>
                </AdminCard>
                <AdminLiveStatus label="Email observability live" />
              </div>
            ) : null}

            {!loading && !error && activeSection === 'webhooks' ? (
              <div className={styles.brandKitLayout}>
                <div className={styles.brandKitHeading}>
                  <h3>Webhooks</h3>
                  <p>Integration subscriptions, signing secrets, and retry visibility remain in the existing panel.</p>
                </div>
                <IntegrationsPanel />
              </div>
            ) : null}

            {!loading && !error && activeSection === 'setup' ? (
              <div className={styles.setupPanel}>
                <AdminCard className={styles.setupSummaryCard} variant="card">
                  <h4>Setup mode</h4>
                  <p className={styles.statusText}>
                    This page checks runtime setup status. It does not save secrets or run local setup commands from
                    the browser. Use the CLI commands below to write <code>.env.local</code>, run Prisma setup, and
                    configure provider webhooks.
                  </p>
                </AdminCard>

                {showSetupDiagnostics ? (
                  <AdminCard className={styles.setupSummaryCard} variant="card">
                    <div>
                      <p className={styles.eyebrow}>Setup health</p>
                      <h3 className={styles.setupHeadline}>{setupStatus?.overallStatus?.replaceAll('_', ' ') || 'unknown'}</h3>
                      <p className={styles.statusText}>Completion: {setupCompletionPercent}%</p>
                    </div>
                    <div className={styles.setupMeterTrack} role="img" aria-label={`Setup completion ${setupCompletionPercent}%`}>
                      <div className={styles.setupMeterFill} style={{ width: `${setupCompletionPercent}%` }} />
                    </div>
                  </AdminCard>
                ) : null}

                {showSetupLoadingState ? (
                  <div className={styles.statusBlock}>
                    <div className={styles.loadingLine} />
                    <div className={styles.loadingLine} />
                    <div className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
                    <p className={styles.statusText}>Loading setup diagnostics...</p>
                  </div>
                ) : null}

                {showSetupErrorState ? (
                  <div className={styles.statusBlock}>
                    <p className={styles.statusTitle}>Setup diagnostics error</p>
                    <p className={styles.statusText}>{setupError}</p>
                  </div>
                ) : null}

                {!showSetupLoadingState && !showSetupErrorState && !showSetupDiagnostics && setupLoaded ? (
                  <div className={styles.statusBlock}>
                    <p className={styles.statusTitle}>Setup diagnostics unavailable</p>
                    <p className={styles.statusText}>The diagnostics payload is missing expected checklist data.</p>
                  </div>
                ) : null}

                {showSetupDiagnostics ? (
                  <>
                    <section className={styles.setupGrid}>
                      {setupCards.map((card) => (
                        <AdminCard as="article" className={styles.setupCard} key={card.id} variant="card">
                          <div className={styles.setupCardHeader}>
                            <h4>{card.label}</h4>
                            <AdminStatusChip tone={card.status === 'PASS' ? 'success' : card.status === 'FAIL' ? 'danger' : 'warning'}>
                              {card.status}
                            </AdminStatusChip>
                          </div>
                          <p className={styles.statusText}>{card.summary}</p>
                          {card.fix ? <p className={styles.setupFixText}>Fix: {card.fix}</p> : null}
                        </AdminCard>
                      ))}
                    </section>

                    <section className={styles.setupColumns}>
                      <AdminCard as="article" className={styles.setupColumnCard} variant="card">
                        <h4>Missing env warnings</h4>
                        {setupMissingEnvVars.length ? (
                          <div className={styles.warningTagList}>
                            {setupMissingEnvVars.map((envName) => (
                              <AdminStatusChip key={envName} tone="warning">{envName}</AdminStatusChip>
                            ))}
                          </div>
                        ) : (
                          <p className={styles.statusText}>No env variable gaps detected in current diagnostics.</p>
                        )}
                      </AdminCard>

                      <AdminCard as="article" className={styles.setupColumnCard} variant="card">
                        <h4>Copy .env template</h4>
                        <div className={styles.commandList}>
                          <div className={styles.commandRow}>
                            <code className={styles.commandCode}>.env.local template</code>
                            <AdminButton
                              onClick={() => handleCopyCommand('env-template', SETUP_ENV_TEMPLATE)}
                              size="sm"
                              variant="secondary"
                            >
                              {setupCopiedCommandId === 'env-template' ? 'Copied' : 'Copy'}
                            </AdminButton>
                          </div>
                        </div>
                        <pre className={styles.setupTemplateCode}>{SETUP_ENV_TEMPLATE}</pre>
                      </AdminCard>
                    </section>

                    <section className={styles.setupColumns}>
                      <AdminCard as="article" className={styles.setupColumnCard} variant="card">
                        <h4>Copy/paste CLI commands</h4>
                        <div className={styles.commandList}>
                          {SETUP_COMMANDS.map((entry) => (
                            <div className={styles.commandRow} key={entry.id}>
                              <code className={styles.commandCode}>{entry.command}</code>
                              <AdminButton
                                onClick={() => handleCopyCommand(entry.id, entry.command)}
                                size="sm"
                                variant="secondary"
                              >
                                {setupCopiedCommandId === entry.id ? 'Copied' : 'Copy'}
                              </AdminButton>
                            </div>
                          ))}
                        </div>
                      </AdminCard>

                      <AdminCard as="article" className={styles.setupColumnCard} variant="card">
                        <h4>Provider verification</h4>
                        <p className={styles.statusText}>
                          Provider API verification is not available from this screen yet.
                        </p>
                        <div className={styles.setupActionButtons}>
                          {SETUP_PROVIDER_VERIFICATION_PLACEHOLDERS.map((label) => (
                            <AdminButton disabled key={label} size="sm" variant="secondary">
                              {label}
                            </AdminButton>
                          ))}
                        </div>
                      </AdminCard>
                    </section>

                    <section className={styles.setupColumns}>
                      <AdminCard as="article" className={styles.setupColumnCard} variant="card">
                        <h4>Required next steps</h4>
                        {setupRequiredNextSteps.length ? (
                          <ul className={styles.setupList}>
                            {setupRequiredNextSteps.map((action) => (
                              <li key={action}>{action}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className={styles.statusText}>No required steps right now.</p>
                        )}
                      </AdminCard>

                      <AdminCard as="article" className={styles.setupColumnCard} variant="card">
                        <h4>Provider setup steps</h4>
                        {setupProviderSetupSteps.length ? (
                          <ul className={styles.setupList}>
                            {setupProviderSetupSteps.map((action) => (
                              <li key={action}>{action}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className={styles.statusText}>No provider setup steps right now.</p>
                        )}
                      </AdminCard>
                    </section>

                    <section className={styles.setupColumns}>
                      <AdminCard as="article" className={styles.setupColumnCard} variant="card">
                        <h4>Optional production steps</h4>
                        {setupOptionalProductionSteps.length ? (
                          <ul className={styles.setupList}>
                            {setupOptionalProductionSteps.map((action) => (
                              <li key={action}>{action}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className={styles.statusText}>No optional production steps right now.</p>
                        )}
                      </AdminCard>

                      <AdminCard as="article" className={styles.setupColumnCard} variant="card">
                        <h4>General setup hints</h4>
                        <ul className={styles.setupList}>
                          {PROVIDER_HINTS.map((hint) => (
                            <li key={hint}>{hint}</li>
                          ))}
                        </ul>
                      </AdminCard>
                    </section>
                  </>
                ) : null}
              </div>
            ) : null}

          </div>
        </div>
      </div>
    </AppShell>
  );
}
