"use client";

export default function AdminField({ children, className = "", label = "", hint = "" }) {
  return (
    <label className={`admin-field ${className}`.trim()}>
      {label ? <span className="admin-field__label">{label}</span> : null}
      {children}
      {hint ? <small className="admin-field__hint">{hint}</small> : null}
    </label>
  );
}
