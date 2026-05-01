"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminSelect({
  className = "",
  disabled = false,
  onChange,
  options = [],
  placeholder = "Select",
  value = "",
}) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState({});
  const [mounted, setMounted] = useState(false);

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
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    const updatePosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      const menuRect = menuRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const viewportWidth = window.innerWidth;
      const width = Math.max(triggerRect.width, 220);
      let left = triggerRect.left;
      if (menuRect?.width && menuRect.width > viewportWidth - 16) {
        left = 8;
      } else {
        left = Math.max(8, Math.min(left, viewportWidth - width - 8));
      }

      setMenuStyle({
        "--admin-select-top": `${triggerRect.bottom + 6}px`,
        "--admin-select-left": `${left}px`,
        "--admin-select-width": `${width}px`,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event) => {
      const target = event.target;
      const insideRoot = rootRef.current && rootRef.current.contains(target);
      const insideMenu = menuRef.current && menuRef.current.contains(target);
      if (!insideRoot && !insideMenu) {
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
    if (disabled) return;
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
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        <span className="admin-select__value">{selectedOption?.label || placeholder}</span>
        <span className="material-symbols-outlined admin-select__chevron" aria-hidden="true">keyboard_arrow_down</span>
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="admin-select__menu"
              onKeyDown={handleListKeyDown}
              ref={menuRef}
              role="listbox"
              style={menuStyle}
              tabIndex={-1}
            >
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
