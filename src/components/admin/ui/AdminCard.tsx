"use client";

import type { ElementType, ReactNode } from 'react';

function buildClassName(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type AdminCardProps = {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  interactive?: boolean;
  spotlight?: boolean;
  variant?: 'panel' | 'card' | string;
  [key: string]: unknown;
};

export default function AdminCard({
  as: Component = 'section',
  children,
  className = '',
  interactive = false,
  spotlight = false,
  variant = 'panel',
  ...props
}: AdminCardProps) {
  return (
    <Component
      className={buildClassName([
        'admin-card',
        `admin-card--${variant}`,
        interactive ? 'is-interactive' : '',
        spotlight ? 'admin-spotlight' : '',
        className,
      ])}
      {...props}
    >
      {children}
    </Component>
  );
}
