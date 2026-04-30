"use client";

import AdminCard from "./AdminCard";

export function AdminStatsGrid({ children, className = "" }) {
  return <div className={`admin-stats-grid ${className}`.trim()}>{children}</div>;
}

export default function AdminStatCard({
  label = "",
  value = "",
  meta = "",
  className = "",
  children = null,
  spotlight = true,
}) {
  return (
    <AdminCard className={`admin-stat-card ${className}`.trim()} spotlight={spotlight} variant="card">
      {label ? <span className="admin-stat-card__label">{label}</span> : null}
      {value ? <strong className="admin-stat-card__value font-headline">{value}</strong> : null}
      {meta ? <small className="admin-stat-card__meta">{meta}</small> : null}
      {children}
    </AdminCard>
  );
}
