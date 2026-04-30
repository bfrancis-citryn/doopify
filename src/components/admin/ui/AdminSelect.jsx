"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminSelect({
  className = "",
  onChange,
  options = [],
  placeholder = "Select",
  value = "",
}) {
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [options, value]);

  useEffect(() => {
    if (open) {
      menuRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function commitOption(option) {
    if (!option) return;
    onChange?.(option.value);
    setOpen(false);
  }

  function handleTriggerKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      return;
    }
  }

  function handleListKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % Math.max(options.length, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? Math.max(options.length - 1, 0) : current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commitOption(options[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className={buildClassName(["admin-select", className])} ref={rootRef}>
      <button
        aria-expanded={open}
        className="admin-select__trigger"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        type="button"
      >
        <span className="admin-select__value">{selectedOption?.label || placeholder}</span>
        <span className="material-symbols-outlined admin-select__chevron" aria-hidden="true">keyboard_arrow_down</span>
      </button>

      {open ? (
        <div className="admin-select__menu" onKeyDown={handleListKeyDown} ref={menuRef} role="listbox" tabIndex={-1}>
          {options.map((option, index) => (
            <button
              aria-selected={option.value === value}
              className={buildClassName([
                "admin-select__option",
                option.value === value ? "is-selected" : "",
                index === activeIndex ? "is-active" : "",
              ])}
              key={option.value}
              onClick={() => commitOption(option)}
              type="button"
            >
              <span>{option.label}</span>
              {option.value === value ? (
                <span className="material-symbols-outlined admin-select__check" aria-hidden="true">check</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
