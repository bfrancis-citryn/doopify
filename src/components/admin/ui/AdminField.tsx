"use client";

import type { ReactNode } from 'react';

type AdminFieldProps = {
  children?: ReactNode;
  className?: string;
  hint?: ReactNode;
  label?: ReactNode;
};

export default function AdminField({ children, className = '', label = '', hint = '' }: AdminFieldProps) {
  return (
    <label className={`admin-field ${className}`.trim()}>
      {label ? <span className="admin-field__label">{label}</span> : null}
      {children}
      {hint ? <small className="admin-field__hint">{hint}</small> : null}
    </label>
  );
}
