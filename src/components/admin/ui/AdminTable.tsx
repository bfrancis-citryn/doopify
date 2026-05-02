"use client";

import type { ReactNode } from 'react';
import AdminSkeleton from './AdminSkeleton';

function buildClassName(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type AdminTableRow = Record<string, unknown> & { id?: string | number | null };

type AdminTableColumn<TRow extends AdminTableRow = AdminTableRow> = {
  accessorKey?: keyof TRow | string;
  cellClassName?: string;
  header: ReactNode;
  headerClassName?: string;
  key?: string;
  render?: (row: TRow, rowIndex: number) => ReactNode;
};

type AdminTableProps<TRow extends AdminTableRow = AdminTableRow> = {
  className?: string;
  columns?: AdminTableColumn<TRow>[];
  emptyDescription?: ReactNode;
  emptyTitle?: ReactNode;
  getRowId?: (row: TRow) => string | number | null | undefined;
  isLoading?: boolean;
  onRowClick?: (row: TRow) => void;
  rows?: TRow[];
  selectedId?: string | number | null;
};

function renderCellContent<TRow extends AdminTableRow>(column: AdminTableColumn<TRow>, row: TRow, rowIndex: number) {
  if (typeof column.render === 'function') {
    return column.render(row, rowIndex);
  }

  if (column.accessorKey) {
    return row[column.accessorKey as keyof TRow] as ReactNode;
  }

  return null;
}

export default function AdminTable<TRow extends AdminTableRow = AdminTableRow>({
  className = '',
  columns = [],
  emptyDescription = 'Try changing filters or adding a new record.',
  emptyTitle = 'No results found',
  getRowId = (row) => row.id,
  isLoading = false,
  onRowClick,
  rows = [],
  selectedId = null,
}: AdminTableProps<TRow>) {
  return (
    <div className={buildClassName(['admin-table-shell glass-card refraction-edge', className])}>
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.headerClassName || ''} key={column.key || String(column.header)}>
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
                      onRowClick ? 'is-clickable' : '',
                      isSelected ? 'is-selected' : '',
                    ])}
                    key={rowId ?? rowIndex}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <td className={column.cellClassName || ''} key={`${column.key || String(column.header)}-${rowId ?? rowIndex}`}>
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
