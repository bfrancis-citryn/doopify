"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  buildSettingsPatchPayload,
  SETTINGS_DEFAULTS,
  transformStore,
} from './settings-context.helpers'

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS);
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
        body: JSON.stringify(buildSettingsPatchPayload(patch)),
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
