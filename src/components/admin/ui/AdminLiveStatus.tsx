"use client";

import type { ReactNode } from 'react';

function buildClassName(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type AdminLiveStatusProps = {
  className?: string;
  label?: ReactNode;
  live?: boolean;
  tone?: 'success' | 'neutral' | 'warning' | 'danger' | 'info' | string;
};

export default function AdminLiveStatus({
  className = '',
  label = 'Webhook worker live',
  live = true,
  tone = 'success',
}: AdminLiveStatusProps) {
  return (
    <span className={buildClassName(['admin-live-status', live ? 'is-live' : 'is-idle', `tone-${tone}`, className])}>
      <span className="admin-live-status__dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
