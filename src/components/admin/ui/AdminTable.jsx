"use client";

import AdminSkeleton from "./AdminSkeleton";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

function renderCellContent(column, row, rowIndex) {
  if (typeof column.render === "function") {
    return column.render(row, rowIndex);
  }

  if (column.accessorKey) {
    return row[column.accessorKey];
  }

  return null;
}

export default function AdminTable({
  className = "",
  columns = [],
  emptyDescription = "Try changing filters or adding a new record.",
  emptyTitle = "No results found",
  getRowId = (row) => row.id,
  isLoading = false,
  onRowClick,
  rows = [],
  selectedId = null,
}) {
  return (
    <div className={buildClassName(["admin-table-shell glass-card refraction-edge", className])}>
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.headerClassName || ""} key={column.key || column.header}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <tr key={`skeleton-${index}`}>
                  <td colSpan={Math.max(columns.length, 1)}>
                    <AdminSkeleton variant="row" />
                  </td>
                </tr>
              ))
            : null}

          {!isLoading && rows.length === 0 ? (
            <tr>
              <td className="admin-table__empty" colSpan={Math.max(columns.length, 1)}>
                <strong>{emptyTitle}</strong>
                <span>{emptyDescription}</span>
              </td>
            </tr>
          ) : null}

          {!isLoading
            ? rows.map((row, rowIndex) => {
                const rowId = getRowId(row);
                const isSelected = selectedId != null && selectedId === rowId;

                return (
                  <tr
                    className={buildClassName([
                      onRowClick ? "is-clickable" : "",
                      isSelected ? "is-selected" : "",
                    ])}
                    key={rowId ?? rowIndex}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <td className={column.cellClassName || ""} key={`${column.key || column.header}-${rowId ?? rowIndex}`}>
                        {renderCellContent(column, row, rowIndex)}
                      </td>
                    ))}
                  </tr>
                );
              })
            : null}
        </tbody>
      </table>
    </div>
  );
}
