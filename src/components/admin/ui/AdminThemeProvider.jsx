"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "doopify.dashboard.theme";
const VALID_PREFERENCES = new Set(["dark", "light", "system"]);

const AdminThemeContext = createContext({
  themePreference: "system",
  resolvedTheme: "dark",
  setThemePreference: () => {},
});

function applyTheme(theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-dashboard-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function useAdminTheme() {
  return useContext(AdminThemeContext);
}

export default function AdminThemeProvider({ children }) {
  const [themePreference, setThemePreferenceState] = useState("system");
  const [resolvedTheme, setResolvedTheme] = useState("dark");

  function resolveTheme(preference) {
    if (preference === "system") {
      if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
      }
      return "dark";
    }
    return preference === "light" ? "light" : "dark";
  }

  useEffect(() => {
    const savedPreference = window.localStorage.getItem(STORAGE_KEY);
    const nextPreference = VALID_PREFERENCES.has(savedPreference) ? savedPreference : "system";
    const nextResolvedTheme = resolveTheme(nextPreference);
    setThemePreferenceState(nextPreference);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextResolvedTheme);
  }, []);

  useEffect(() => {
    const nextResolvedTheme = resolveTheme(themePreference);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextResolvedTheme);

    if (themePreference !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => {
      const systemResolvedTheme = mediaQuery.matches ? "light" : "dark";
      setResolvedTheme(systemResolvedTheme);
      applyTheme(systemResolvedTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themePreference]);

  const setThemePreference = (nextPreference) => {
    const validPreference = VALID_PREFERENCES.has(nextPreference) ? nextPreference : "system";
    const nextResolvedTheme = resolveTheme(validPreference);
    setThemePreferenceState(validPreference);
    setResolvedTheme(nextResolvedTheme);
    window.localStorage.setItem(STORAGE_KEY, validPreference);
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
