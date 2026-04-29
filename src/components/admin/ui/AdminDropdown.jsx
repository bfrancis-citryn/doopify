"use client";

import { useEffect, useRef, useState } from "react";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminDropdown({
  align = "end",
  children,
  className = "",
  open,
  onOpenChange,
  trigger,
}) {
  const rootRef = useRef(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open : internalOpen;

  const setOpen = (nextOpen) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={buildClassName(["admin-dropdown", className])} ref={rootRef}>
      <div className="admin-dropdown__trigger" onClick={() => setOpen(!isOpen)} role="presentation">
        {trigger}
      </div>
      {isOpen ? (
        <div className={buildClassName(["admin-dropdown__menu", `is-${align}`])} role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
}
