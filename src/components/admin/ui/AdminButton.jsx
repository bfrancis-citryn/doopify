"use client";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminButton({
  children,
  className = "",
  disabled = false,
  leftIcon = null,
  loading = false,
  rightIcon = null,
  size = "md",
  type = "button",
  variant = "secondary",
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={buildClassName([
        "admin-btn",
        `admin-btn--${variant}`,
        `admin-btn--${size}`,
        loading ? "is-loading" : "",
        className,
      ])}
      disabled={isDisabled}
      type={type}
      {...props}
    >
      {loading ? <span className="admin-btn__spinner" aria-hidden="true" /> : null}
      {leftIcon ? <span className="admin-btn__icon">{leftIcon}</span> : null}
      {children ? <span className="admin-btn__label">{children}</span> : null}
      {rightIcon ? <span className="admin-btn__icon">{rightIcon}</span> : null}
    </button>
  );
}
