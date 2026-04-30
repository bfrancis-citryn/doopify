"use client";

export default function AdminTooltip({ content = "", label = "More info" }) {
  return (
    <span className="admin-tooltip">
      <button aria-label={label} className="admin-tooltip__trigger" title={content} type="button">
        <span className="material-symbols-outlined" aria-hidden="true">info</span>
      </button>
      <span className="admin-tooltip__bubble" role="tooltip">{content}</span>
    </span>
  );
}
