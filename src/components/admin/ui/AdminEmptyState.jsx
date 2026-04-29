"use client";

import AdminButton from './AdminButton';

export default function AdminEmptyState({ action = null, actionLabel = '', description = '', icon = 'inbox', onAction, title = '' }) {
  return (
    <div className="admin-empty-state admin-card admin-card--card admin-spotlight">
      <span className="material-symbols-outlined admin-empty-state__icon" aria-hidden="true">{icon}</span>
      {title ? <h3 className="admin-empty-state__title font-headline">{title}</h3> : null}
      {description ? <p className="admin-empty-state__description">{description}</p> : null}
      {action ? action : null}
      {!action && onAction && actionLabel ? (
        <AdminButton onClick={onAction} size="sm" variant="primary">{actionLabel}</AdminButton>
      ) : null}
    </div>
  );
}
