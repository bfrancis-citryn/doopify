"use client";

import { useAdminTheme } from "./AdminThemeProvider";

export default function AdminThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useAdminTheme();
  const isDark = theme === "dark";

  return (
    <button
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`admin-theme-toggle ${isDark ? "is-dark" : "is-light"} ${className}`.trim()}
      onClick={toggleTheme}
      type="button"
    >
      <span className="admin-theme-toggle__label">Dark</span>
      <span className="admin-theme-toggle__track" aria-hidden="true">
        <span className="admin-theme-toggle__thumb">
          <span className="material-symbols-outlined">
            {isDark ? "dark_mode" : "light_mode"}
          </span>
        </span>
      </span>
      <span className="admin-theme-toggle__label">Light</span>
    </button>
  );
}
