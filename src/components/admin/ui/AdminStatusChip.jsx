"use client";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminStatusChip({ children, className = "", tone = "neutral" }) {
  return (
    <span className={buildClassName(["admin-status-chip", `tone-${tone}`, className])}>
      {children}
    </span>
  );
}
