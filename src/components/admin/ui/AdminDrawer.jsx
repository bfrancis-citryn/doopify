"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AdminButton from "./AdminButton";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminDrawer({
  activeTabId = null,
  actions = null,
  children = null,
  className = "",
  contextItems = [],
  footer = null,
  headerActions = null,
  onActiveTabChange = null,
  onClose,
  open = false,
  subtitle = "",
  tabs = [],
  title = "Details",
}) {
  const isTabControlled = activeTabId != null;
  const [activeTab, setActiveTab] = useState(null);
  const [mounted, setMounted] = useState(false);
  const hasTabs = tabs.length > 0;
  const lastOpenRef = useRef(false);
  const resolvedActiveTab = isTabControlled ? activeTabId : activeTab;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const openingNow = open && !lastOpenRef.current;
    const tabIds = tabs.map((tab) => tab.id);
    const firstTabId = tabs[0]?.id ?? null;

    if (open && hasTabs) {
      const nextTab = (() => {
        if (openingNow) return firstTabId;
        if (resolvedActiveTab && tabIds.includes(resolvedActiveTab)) return resolvedActiveTab;
        return firstTabId;
      })();

      if (isTabControlled) {
        if (nextTab && nextTab !== resolvedActiveTab) {
          onActiveTabChange?.(nextTab);
        }
      } else {
        setActiveTab(nextTab);
      }
    }

    if (open && !hasTabs && isTabControlled && resolvedActiveTab != null) {
      onActiveTabChange?.(null);
    }

    lastOpenRef.current = open;
  }, [hasTabs, isTabControlled, onActiveTabChange, open, resolvedActiveTab, tabs]);

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

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [open]);

  const content = useMemo(() => {
    if (!hasTabs) {
      return children;
    }

    const currentTab = tabs.find((tab) => tab.id === resolvedActiveTab) ?? tabs[0];
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
  }, [children, hasTabs, resolvedActiveTab, tabs]);

  if (!open || !mounted) {
    return null;
  }

  const handleOverlayClick = () => {
    if (typeof onClose === "function") {
      onClose();
    }
  };

  const drawerUi = (
    <div className="admin-drawer-root" role="presentation">
      <div aria-hidden="true" className="admin-drawer-overlay" onClick={handleOverlayClick} />
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
          <div className="admin-drawer__header-actions">
            {headerActions}
            <AdminButton aria-label="Close drawer" onClick={onClose} size="sm" variant="icon">
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </AdminButton>
          </div>
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
                  resolvedActiveTab === tab.id ? "is-active" : "",
                ])}
                key={tab.id}
                onClick={() => {
                  if (isTabControlled) {
                    onActiveTabChange?.(tab.id);
                    return;
                  }
                  setActiveTab(tab.id);
                }}
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

  return createPortal(drawerUi, document.body);
}
