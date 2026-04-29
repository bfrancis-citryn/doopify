"use client";

import AdminCard from './AdminCard';

export default function AdminFormSection({ children, description = '', eyebrow = '', title = '' }) {
  return (
    <AdminCard className="admin-form-section admin-spotlight" variant="card">
      {eyebrow ? <p className="admin-form-section__eyebrow">{eyebrow}</p> : null}
      {title ? <h3 className="admin-form-section__title font-headline">{title}</h3> : null}
      {description ? <p className="admin-form-section__description">{description}</p> : null}
      <div className="admin-form-section__body">{children}</div>
    </AdminCard>
  );
}
