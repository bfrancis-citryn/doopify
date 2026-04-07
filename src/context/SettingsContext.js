"use client";

import { createContext, useContext, useMemo, useState } from 'react';

const SettingsContext = createContext(null);

const initialSettings = {
  storeName: 'Doopify',
  supportEmail: 'support@doopify.com',
  phone: '(310) 555-0100',
  address: '4476 Santa Monica Blvd, Los Angeles, CA',
  timezone: 'America/Los_Angeles',
  currency: 'USD',
  logoUrl: '',
  brandPrimary: '#004fc4',
  brandAccent: '#60a5fa',
  orderPrefix: 'DPY',
  defaultLocation: 'Los Angeles warehouse',
  shippingOrigin: 'Los Angeles warehouse',
  freeShippingThreshold: '100',
  senderEmail: 'hello@doopify.com',
  lowInventoryAlert: '5',
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(initialSettings);

  const updateSettings = patch => {
    setSettings(current => ({
      ...current,
      ...patch,
    }));
  };

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      setSettings,
    }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }

  return context;
}
