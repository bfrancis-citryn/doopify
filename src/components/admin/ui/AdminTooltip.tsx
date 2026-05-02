"use client";

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function AdminTooltip({ content = '', label = 'More info' }: { content?: string; label?: string }) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const left = Math.min(window.innerWidth - 14, Math.max(14, rect.left + rect.width / 2));
      const top = Math.max(10, rect.top - 8);
      setStyle({
        '--admin-tooltip-left': `${left}px`,
        '--admin-tooltip-top': `${top}px`,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <span
      className="admin-tooltip"
      onBlur={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        aria-label={label}
        className="admin-tooltip__trigger"
        ref={triggerRef}
        title={content}
        type="button"
      >
        <span className="material-symbols-outlined" aria-hidden="true">info</span>
      </button>
      {open
        ? createPortal(
            <span className="admin-tooltip__bubble" role="tooltip" style={style}>
              {content}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
