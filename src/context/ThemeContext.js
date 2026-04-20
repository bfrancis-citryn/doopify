"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = 'doopify-theme';
const VALID_THEMES = new Set(['system', 'light', 'dark']);

function normalizeTheme(value) {
  return VALID_THEMES.has(value) ? value : 'system';
}

function resolveTheme(nextTheme) {
  if (nextTheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return nextTheme;
}

function getInitialResolvedTheme(initialTheme) {
  return initialTheme === 'dark' ? 'dark' : 'light';
}

function persistTheme(nextTheme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${THEME_STORAGE_KEY}=${nextTheme}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function ThemeProvider({ children, initialTheme = 'system' }) {
  const normalizedInitialTheme = normalizeTheme(initialTheme);
  const [theme, setTheme] = useState(normalizedInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState(() => getInitialResolvedTheme(normalizedInitialTheme));

  useEffect(() => {
    const applyTheme = nextTheme => {
      const nextResolvedTheme = resolveTheme(nextTheme);
      setResolvedTheme(nextResolvedTheme);
      document.documentElement.dataset.theme = nextResolvedTheme;
      document.documentElement.style.colorScheme = nextResolvedTheme;
    };

    applyTheme(theme);
    persistTheme(theme);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme(theme);
    media.addEventListener('change', handleChange);

    return () => media.removeEventListener('change', handleChange);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
}
