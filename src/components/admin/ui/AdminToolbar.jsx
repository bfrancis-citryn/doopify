"use client";

export default function AdminToolbar({ actions = null, children = null, className = '' }) {
  return (
    <div className={`admin-toolbar admin-spotlight ${className}`.trim()}>
      <div className="admin-toolbar__left">{children}</div>
      {actions ? <div className="admin-toolbar__right">{actions}</div> : null}
    </div>
  );
}
