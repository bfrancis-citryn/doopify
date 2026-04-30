"use client";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminSelectableTile({
  action,
  className = "",
  disabled = false,
  footer,
  media,
  onClick,
  selected = false,
  subtitle,
  title,
  type = "button",
  ...props
}) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      className={buildClassName([
        "admin-selectable-tile",
        selected ? "is-selected" : "",
        onClick ? "is-clickable" : "",
        className,
      ])}
      disabled={onClick ? disabled : undefined}
      onClick={onClick}
      {...props}
      type={onClick ? type : undefined}
    >
      {media ? (
        <div className="admin-selectable-tile__media">
          {media}
          {selected ? (
            <span className="admin-selectable-tile__check" aria-hidden="true">
              <span className="material-symbols-outlined">check</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {title || subtitle ? (
        <div className="admin-selectable-tile__copy">
          {title ? <p className="admin-selectable-tile__title">{title}</p> : null}
          {subtitle ? <p className="admin-selectable-tile__subtitle">{subtitle}</p> : null}
        </div>
      ) : null}

      {footer ? <div className="admin-selectable-tile__footer">{footer}</div> : null}
      {action ? <div className="admin-selectable-tile__action">{action}</div> : null}
    </Component>
  );
}
