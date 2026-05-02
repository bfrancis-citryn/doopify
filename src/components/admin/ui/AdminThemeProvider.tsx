"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export const STORAGE_KEY = 'doopify.dashboard.theme';
const VALID_PREFERENCES = new Set(['dark', 'light', 'system']);
const THEME_ATTRIBUTE = 'data-dashboard-theme';

type ThemePreference = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

type AdminThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (preference: ThemePreference | string) => void;
};

const AdminThemeContext = createContext<AdminThemeContextValue>({
  themePreference: 'system',
  resolvedTheme: 'dark',
  setThemePreference: () => {},
});

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && VALID_PREFERENCES.has(value);
}

function applyTheme(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return;

  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  document.documentElement.style.colorScheme = theme;
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }
  return preference === 'light' ? 'light' : 'dark';
}

function getInitialPreference(): ThemePreference {
  if (typeof document !== 'undefined') {
    const serverPreference = document.documentElement.getAttribute('data-dashboard-theme-preference');
    if (isThemePreference(serverPreference)) return serverPreference;
  }

  if (typeof window !== 'undefined') {
    const savedPreference = window.localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(savedPreference)) return savedPreference;
  }

  return 'system';
}

function getInitialResolvedTheme(initialPreference: ThemePreference): ResolvedTheme {
  if (typeof document !== 'undefined') {
    const renderedTheme = document.documentElement.getAttribute(THEME_ATTRIBUTE);
    if (renderedTheme === 'light' || renderedTheme === 'dark') return renderedTheme;
  }

  return resolveTheme(initialPreference);
}

export function useAdminTheme() {
  return useContext(AdminThemeContext);
}

export default function AdminThemeProvider({ children }: { children?: ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => getInitialPreference());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => getInitialResolvedTheme(getInitialPreference()));

  useEffect(() => {
    const nextResolvedTheme = resolveTheme(themePreference);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextResolvedTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, themePreference);
    } catch {}
    document.documentElement.setAttribute('data-dashboard-theme-preference', themePreference);

    if (themePreference !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => {
      const systemResolvedTheme = mediaQuery.matches ? 'light' : 'dark';
      setResolvedTheme(systemResolvedTheme);
      applyTheme(systemResolvedTheme);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [themePreference]);

  const setThemePreference = (nextPreference: ThemePreference | string) => {
    const validPreference = isThemePreference(nextPreference) ? nextPreference : 'system';
    const nextResolvedTheme = resolveTheme(validPreference);
    setThemePreferenceState(validPreference);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextResolvedTheme);
  };

  const value = useMemo(
    () => ({ themePreference, resolvedTheme, setThemePreference }),
    [themePreference, resolvedTheme]
  );

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}
