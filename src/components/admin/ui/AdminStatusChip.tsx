"use client";

import type { ReactNode } from 'react';

function buildClassName(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type AdminStatusChipProps = {
  children?: ReactNode;
  className?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | string;
};

export default function AdminStatusChip({ children, className = '', tone = 'neutral' }: AdminStatusChipProps) {
  return (
    <span className={buildClassName(['admin-status-chip', `tone-${tone}`, className])}>
      {children}
    </span>
  );
}
