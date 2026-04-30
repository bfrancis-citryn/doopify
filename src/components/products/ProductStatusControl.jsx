"use client";

import AdminButton from "../admin/ui/AdminButton";
import AdminStatusChip from "../admin/ui/AdminStatusChip";
import styles from "./ProductStatusControl.module.css";

const STATUS_OPTIONS = [
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "archived", label: "Archived" },
];

export default function ProductStatusControl({
  value = "draft",
  computedState,
  scheduleLabel = "",
  onChange,
}) {
  return (
    <div className={styles.root}>
      <div className={styles.segmented}>
        {STATUS_OPTIONS.map((option) => {
          const isSelected = value === option.id;
          const isArchived = option.id === "archived";

          return (
            <AdminButton
              className={isSelected ? styles.selectedButton : ""}
              key={option.id}
              onClick={() => onChange?.(option.id)}
              size="sm"
              type="button"
              variant={isArchived ? "danger" : isSelected ? "primary" : "secondary"}
            >
              {option.label}
            </AdminButton>
          );
        })}
      </div>

      {computedState?.state === "scheduled" && scheduleLabel ? (
        <AdminStatusChip tone="info">{scheduleLabel}</AdminStatusChip>
      ) : null}
    </div>
  );
}
