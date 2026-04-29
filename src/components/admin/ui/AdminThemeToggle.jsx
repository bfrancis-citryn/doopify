"use client";

import AdminButton from "./AdminButton";
import { useAdminTheme } from "./AdminThemeProvider";

export default function AdminThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useAdminTheme();

  return (
    <AdminButton
      className={`admin-theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      size="sm"
      variant="ghost"
    >
      {theme === "dark" ? "Dark" : "Light"}
    </AdminButton>
  );
}
