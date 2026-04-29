"use client";

import { useEffect, useMemo, useState } from "react";
import AdminButton from "./AdminButton";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminDrawer({
  actions = null,
  children = null,
  className = "",
  contextItems = [],
  footer = null,
  onClose,
  open = false,
  subtitle = "",
  tabs = [],
  title = "Details",
}) {
  const [activeTab, setActiveTab] = useState(null);
  const hasTabs = tabs.length > 0;

  useEffect(() => {
    if (!open || !hasTabs) {
      return;
    }

    setActiveTab(tabs[0]?.id ?? null);
  }, [open, hasTabs, tabs]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const content = useMemo(() => {
    if (!hasTabs) {
      return children;
    }

    const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
    if (!currentTab) {
      return children;
    }

    if (typeof currentTab.render === "function") {
      return currentTab.render();
    }

    if ("content" in currentTab) {
      return currentTab.content;
    }

    return children;
  }, [activeTab, children, hasTabs, tabs]);

  if (!open) {
    return null;
  }

  return (
    <div className="admin-drawer-root" role="presentation">
      <div className="admin-drawer-overlay" onClick={onClose} />
      <aside
        aria-label={title}
        aria-modal="true"
        className={buildClassName(["admin-drawer", className])}
        role="dialog"
      >
        <header className="admin-drawer__header">
          <div>
            <h2 className="admin-drawer__title">{title}</h2>
            {subtitle ? <p className="admin-drawer__subtitle">{subtitle}</p> : null}
          </div>
          <AdminButton aria-label="Close drawer" onClick={onClose} size="sm" variant="icon">
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </AdminButton>
        </header>

        {contextItems.length ? (
          <div className="admin-drawer__context" aria-label="Context">
            {contextItems.map((item, index) => {
              const label = typeof item === "string" ? item : item.label;
              const isCurrent = typeof item === "string" ? index === contextItems.length - 1 : item.current;

              return (
              <span
                className={buildClassName([
                  "admin-drawer__context-item",
                  isCurrent ? "is-current" : "",
                ])}
                key={`${label}-${index}`}
              >
                {index > 0 ? <span className="admin-drawer__context-divider">/</span> : null}
                <span>{label}</span>
              </span>
              );
            })}
          </div>
        ) : null}

        {hasTabs ? (
          <nav className="admin-drawer__tabs" aria-label="Drawer tabs">
            {tabs.map((tab) => (
              <button
                className={buildClassName([
                  "admin-drawer__tab",
                  activeTab === tab.id ? "is-active" : "",
                ])}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="admin-drawer__content custom-scrollbar">{content}</div>

        {(footer || actions) && (
          <footer className="admin-drawer__footer">
            {footer ? <div className="admin-drawer__footer-copy">{footer}</div> : null}
            {actions ? <div className="admin-drawer__actions">{actions}</div> : null}
          </footer>
        )}
      </aside>
    </div>
  );
}
