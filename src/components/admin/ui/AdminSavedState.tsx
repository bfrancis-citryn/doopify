"use client";

function buildClassName(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type SavedState = 'idle' | 'saved' | 'saving' | 'dirty' | 'error' | string;

type AdminSavedStateProps = {
  className?: string;
  errorCopy?: string;
  savedAgoText?: string;
  state?: SavedState;
};

function getStateCopy(state: SavedState, savedAgoText: string, errorCopy: string) {
  if (state === 'saving') return 'Saving...';
  if (state === 'dirty') return 'Unsaved changes';
  if (state === 'error') return errorCopy || 'Could not save';
  return savedAgoText ? `Saved ${savedAgoText}` : 'Saved';
}

export default function AdminSavedState({
  className = '',
  errorCopy = '',
  savedAgoText = '2s ago',
  state = 'idle',
}: AdminSavedStateProps) {
  const copy = getStateCopy(state, savedAgoText, errorCopy);
  const showCheck = state === 'idle' || state === 'saved';

  return (
    <span className={buildClassName(['admin-saved-state', `is-${state}`, className])}>
      {showCheck ? (
        <span className="material-symbols-outlined" aria-hidden="true">
          check_small
        </span>
      ) : null}
      <span>{copy}</span>
    </span>
  );
}
