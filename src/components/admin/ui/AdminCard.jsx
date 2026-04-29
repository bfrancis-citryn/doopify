"use client";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminCard({
  as: Component = "section",
  children,
  className = "",
  interactive = false,
  spotlight = false,
  variant = "panel",
  ...props
}) {
  return (
    <Component
      className={buildClassName([
        "admin-card",
        `admin-card--${variant}`,
        interactive ? "is-interactive" : "",
        spotlight ? "admin-spotlight" : "",
        className,
      ])}
      {...props}
    >
      {children}
    </Component>
  );
}
