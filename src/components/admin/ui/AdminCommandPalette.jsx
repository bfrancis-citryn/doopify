"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STATIC_COMMANDS = [
  { id: "go-dashboard", label: "Go to Dashboard", path: "/admin", keywords: ["home", "overview"] },
  { id: "go-products", label: "Go to Products", path: "/products", keywords: ["catalog"] },
  { id: "go-orders", label: "Go to Orders", path: "/orders", keywords: ["fulfillment"] },
  { id: "go-collections", label: "Go to Collections", path: "/admin/collections", keywords: ["merchandising"] },
  { id: "go-customers", label: "Go to Customers", path: "/customers", keywords: ["people"] },
  { id: "go-discounts", label: "Go to Discounts", path: "/discounts", keywords: ["codes"] },
  { id: "go-settings", label: "Go to Settings", path: "/settings", keywords: ["configuration"] },
  { id: "go-brand-kit", label: "Open Brand Kit", path: "/admin/brand-kit", keywords: ["branding"] },
  { id: "go-webhooks", label: "Open Webhooks", path: "/admin/webhooks", keywords: ["events"] },
  {
    id: "go-email-deliveries",
    label: "Open Email Deliveries",
    path: "/admin/webhooks",
    keywords: ["resend", "bounces"],
  },
];

function matchCommand(command, query) {
  if (!query) {
    return true;
  }

  const haystack = [command.label, ...(command.keywords ?? [])].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default function AdminCommandPalette() {
  const router = useRouter();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredCommands = useMemo(
    () => STATIC_COMMANDS.filter((command) => matchCommand(command, query)),
    [query]
  );

  useEffect(() => {
    const handlePaletteEvent = (event) => {
      const action = event?.detail?.action || "open";
      if (action === "close") {
        setOpen(false);
        return;
      }
      if (action === "toggle") {
        setOpen((current) => !current);
        return;
      }

      setOpen(true);
    };

    window.addEventListener("admin-command-palette", handlePaletteEvent);

    return () => {
      window.removeEventListener("admin-command-palette", handlePaletteEvent);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isModifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (isModifier && key === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setActiveIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (activeIndex > filteredCommands.length - 1) {
      setActiveIndex(0);
    }
  }, [activeIndex, filteredCommands]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const runCommand = (command) => {
    if (!command) {
      return;
    }

    router.push(command.path);
    setOpen(false);
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % Math.max(filteredCommands.length, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? Math.max(filteredCommands.length - 1, 0) : current - 1
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      runCommand(filteredCommands[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="admin-command-palette-overlay" role="presentation">
      <div
        aria-label="Command palette"
        aria-modal="true"
        className="admin-command-palette"
        ref={rootRef}
        role="dialog"
      >
        <div className="admin-command-palette__input-wrap">
          <span className="material-symbols-outlined" aria-hidden="true">
            search
          </span>
          <input
            className="admin-command-palette__input"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search commands..."
            ref={inputRef}
            value={query}
          />
          <kbd className="admin-command-palette__kbd">Esc</kbd>
        </div>

        <ul className="admin-command-palette__results custom-scrollbar" role="listbox">
          {filteredCommands.length ? (
            filteredCommands.map((command, index) => (
              <li key={command.id}>
                <button
                  className={`admin-command-palette__item ${index === activeIndex ? "is-active" : ""}`}
                  onClick={() => runCommand(command)}
                  type="button"
                >
                  <span>{command.label}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="admin-command-palette__empty">No matching commands</li>
          )}
        </ul>
      </div>
    </div>
  );
}
