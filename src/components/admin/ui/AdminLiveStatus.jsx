"use client";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminLiveStatus({
  className = "",
  label = "Webhook worker live",
  live = true,
  tone = "success",
}) {
  return (
    <span className={buildClassName(["admin-live-status", live ? "is-live" : "is-idle", `tone-${tone}`, className])}>
      <span className="admin-live-status__dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
