"use client";

function buildClassName(parts) {
  return parts.filter(Boolean).join(" ");
}

function getStateCopy(state, savedAgoText, errorCopy) {
  if (state === "saving") {
    return "Saving...";
  }

  if (state === "dirty") {
    return "Unsaved changes";
  }

  if (state === "error") {
    return errorCopy || "Could not save";
  }

  return savedAgoText ? `Saved ${savedAgoText}` : "Saved";
}

export default function AdminSavedState({
  className = "",
  errorCopy = "",
  savedAgoText = "2s ago",
  state = "idle",
}) {
  const copy = getStateCopy(state, savedAgoText, errorCopy);
  const showCheck = state === "idle" || state === "saved";

  return (
    <span className={buildClassName(["admin-saved-state", `is-${state}`, className])}>
      {showCheck ? (
        <span className="material-symbols-outlined" aria-hidden="true">
          check_small
        </span>
      ) : null}
      <span>{copy}</span>
    </span>
  );
}
