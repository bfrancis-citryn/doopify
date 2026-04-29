"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "doopify.dashboard.theme";
const VALID_THEMES = new Set(["dark", "light"]);

const AdminThemeContext = createContext({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
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
  const [theme, setThemeState] = useState("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    const nextTheme = VALID_THEMES.has(savedTheme) ? savedTheme : "dark";
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (nextTheme) => {
    const resolvedTheme = VALID_THEMES.has(nextTheme) ? nextTheme : "dark";
    setThemeState(resolvedTheme);
    window.localStorage.setItem(STORAGE_KEY, resolvedTheme);
    applyTheme(resolvedTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme]
  );

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}
