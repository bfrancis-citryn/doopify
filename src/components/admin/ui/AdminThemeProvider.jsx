"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const STORAGE_KEY = "doopify.dashboard.theme";
const VALID_PREFERENCES = new Set(["dark", "light", "system"]);
const THEME_ATTRIBUTE = "data-dashboard-theme";

const AdminThemeContext = createContext({
  themePreference: "system",
  resolvedTheme: "dark",
  setThemePreference: () => {},
});

function applyTheme(theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  document.documentElement.style.colorScheme = theme;
}

function resolveTheme(preference) {
  if (preference === "system") {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  }
  return preference === "light" ? "light" : "dark";
}

function getInitialPreference() {
  if (typeof document !== "undefined") {
    const serverPreference = document.documentElement.getAttribute("data-dashboard-theme-preference");
    if (VALID_PREFERENCES.has(serverPreference)) {
      return serverPreference;
    }
  }

  if (typeof window !== "undefined") {
    const savedPreference = window.localStorage.getItem(STORAGE_KEY);
    if (VALID_PREFERENCES.has(savedPreference)) {
      return savedPreference;
    }
  }

  return "system";
}

function getInitialResolvedTheme(initialPreference) {
  if (typeof document !== "undefined") {
    const renderedTheme = document.documentElement.getAttribute(THEME_ATTRIBUTE);
    if (renderedTheme === "light" || renderedTheme === "dark") {
      return renderedTheme;
    }
  }

  return resolveTheme(initialPreference);
}

export function useAdminTheme() {
  return useContext(AdminThemeContext);
}

export default function AdminThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState(() => getInitialPreference());
  const [resolvedTheme, setResolvedTheme] = useState(() => getInitialResolvedTheme(getInitialPreference()));

  useEffect(() => {
    const nextResolvedTheme = resolveTheme(themePreference);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextResolvedTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, themePreference);
    } catch {}
    document.documentElement.setAttribute("data-dashboard-theme-preference", themePreference);

    if (themePreference !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => {
      const systemResolvedTheme = mediaQuery.matches ? "light" : "dark";
      setResolvedTheme(systemResolvedTheme);
      applyTheme(systemResolvedTheme);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [themePreference]);

  const setThemePreference = (nextPreference) => {
    const validPreference = VALID_PREFERENCES.has(nextPreference) ? nextPreference : "system";
    const nextResolvedTheme = resolveTheme(validPreference);
    setThemePreferenceState(validPreference);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextResolvedTheme);
  };

  const value = useMemo(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference,
    }),
    [themePreference, resolvedTheme]
  );

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}
