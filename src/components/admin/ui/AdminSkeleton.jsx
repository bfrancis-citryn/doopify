"use client";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

function SkeletonLine({ className = "" }) {
  return <span className={buildClassName(["admin-skeleton", "admin-skeleton--line", className])} />;
}

function SkeletonAvatar({ className = "" }) {
  return <span className={buildClassName(["admin-skeleton", "admin-skeleton--avatar", className])} />;
}

function SkeletonChip({ className = "" }) {
  return <span className={buildClassName(["admin-skeleton", "admin-skeleton--chip", className])} />;
}

function SkeletonRow() {
  return (
    <div className="admin-skeleton-row">
      <SkeletonAvatar />
      <div className="admin-skeleton-row__lines">
        <SkeletonLine />
        <SkeletonLine className="short" />
      </div>
      <SkeletonChip />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="admin-skeleton-card">
      <SkeletonLine className="short" />
      <SkeletonLine />
      <SkeletonLine className="shorter" />
    </div>
  );
}

function SkeletonTable({ columns = 4, rows = 4 }) {
  return (
    <div className="admin-skeleton-table" role="presentation">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div className="admin-skeleton-table__row" key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <SkeletonLine key={`${rowIndex}-${columnIndex}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminSkeleton({ className = "", columns = 4, rows = 4, variant = "line" }) {
  if (variant === "avatar" || variant === "thumb") {
    return <SkeletonAvatar className={className} />;
  }

  if (variant === "chip") {
    return <SkeletonChip className={className} />;
  }

  if (variant === "row") {
    return (
      <div className={className}>
        <SkeletonRow />
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={className}>
        <SkeletonCard />
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={className}>
        <SkeletonTable columns={columns} rows={rows} />
      </div>
    );
  }

  return <SkeletonLine className={className} />;
}
