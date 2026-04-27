"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  storeName: 'Doopify',
  supportEmail: 'support@doopify.com',
  phone: '',
  address: '',
  timezone: 'America/New_York',
  currency: 'USD',
  logoUrl: '',
  brandPrimary: '#004fc4',
  brandAccent: '#60a5fa',
  orderPrefix: 'DPY',
  defaultLocation: 'Main warehouse',
  shippingOrigin: 'Main warehouse',
  freeShippingThreshold: '100',
  domesticShippingRate: '9.99',
  internationalShippingRate: '19.99',
  domesticTaxRate: '7',
  internationalTaxRate: '0',
  senderEmail: 'hello@doopify.com',
  lowInventoryAlert: '5',
};

function parseNumberField(value) {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function transformStore(store) {
  const address = [store.address1, store.city, store.province, store.country]
    .filter(Boolean)
    .join(', ');

  return {
    storeName: store.name || DEFAULT_SETTINGS.storeName,
    supportEmail: store.email || DEFAULT_SETTINGS.supportEmail,
    phone: store.phone || '',
    address,
    timezone: store.timezone || DEFAULT_SETTINGS.timezone,
    currency: store.currency || 'USD',
    logoUrl: store.logoUrl || '',
    brandPrimary: store.primaryColor || DEFAULT_SETTINGS.brandPrimary,
    brandAccent: store.secondaryColor || DEFAULT_SETTINGS.brandAccent,
    orderPrefix: 'DPY',
    defaultLocation: store.city || DEFAULT_SETTINGS.defaultLocation,
    shippingOrigin: store.city || DEFAULT_SETTINGS.shippingOrigin,
    freeShippingThreshold: store.shippingThreshold?.toString() || DEFAULT_SETTINGS.freeShippingThreshold,
    domesticShippingRate:
      store.shippingDomesticRate?.toString() || DEFAULT_SETTINGS.domesticShippingRate,
    internationalShippingRate:
      store.shippingInternationalRate?.toString() || DEFAULT_SETTINGS.internationalShippingRate,
    domesticTaxRate:
      store.domesticTaxRate != null
        ? String(Number(store.domesticTaxRate) * 100)
        : DEFAULT_SETTINGS.domesticTaxRate,
    internationalTaxRate:
      store.internationalTaxRate != null
        ? String(Number(store.internationalTaxRate) * 100)
        : DEFAULT_SETTINGS.internationalTaxRate,
    senderEmail: store.email || DEFAULT_SETTINGS.senderEmail,
    lowInventoryAlert: '5',
    _storeId: store.id,
  };
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings');
        const json = await res.json();
        if (json.success && json.data) {
          setSettings(transformStore(json.data));
        }
      } catch (e) {
        console.error('[SettingsContext]', e);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const updateSettings = useCallback(async patch => {
    setSettings(current => ({ ...current, ...patch }));

    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: patch.storeName,
          email: patch.supportEmail,
          phone: patch.phone,
          timezone: patch.timezone,
          currency: patch.currency,
          logoUrl: patch.logoUrl,
          primaryColor: patch.brandPrimary,
          secondaryColor: patch.brandAccent,
          shippingThreshold: parseNumberField(patch.freeShippingThreshold),
          shippingDomesticRate: parseNumberField(patch.domesticShippingRate),
          shippingInternationalRate: parseNumberField(patch.internationalShippingRate),
          domesticTaxRate:
            patch.domesticTaxRate != null && patch.domesticTaxRate !== ''
              ? Number(patch.domesticTaxRate) / 100
              : undefined,
          internationalTaxRate:
            patch.internationalTaxRate != null && patch.internationalTaxRate !== ''
              ? Number(patch.internationalTaxRate) / 100
              : undefined,
        }),
      });
    } catch (e) {
      console.error('[SettingsContext] save failed', e);
    }
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, setSettings, loading, error }),
    [settings, loading, error, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
