"use client";

import type { ReactNode } from 'react';
import AdminCard from './AdminCard';

type AdminStatsGridProps = {
  children?: ReactNode;
  className?: string;
};

export function AdminStatsGrid({ children, className = '' }: AdminStatsGridProps) {
  return <div className={`admin-stats-grid ${className}`.trim()}>{children}</div>;
}

type AdminStatCardProps = {
  children?: ReactNode;
  className?: string;
  label?: ReactNode;
  meta?: ReactNode;
  spotlight?: boolean;
  value?: ReactNode;
};

export default function AdminStatCard({
  label = '',
  value = '',
  meta = '',
  className = '',
  children = null,
  spotlight = true,
}: AdminStatCardProps) {
  return (
    <AdminCard className={`admin-stat-card ${className}`.trim()} spotlight={spotlight} variant="card">
      {label ? <span className="admin-stat-card__label">{label}</span> : null}
      {value ? <strong className="admin-stat-card__value font-headline">{value}</strong> : null}
      {meta ? <small className="admin-stat-card__meta">{meta}</small> : null}
      {children}
    </AdminCard>
  );
}
