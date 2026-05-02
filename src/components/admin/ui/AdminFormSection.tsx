"use client";

import type { ReactNode } from 'react';
import AdminCard from './AdminCard';

type AdminFormSectionProps = {
  children?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title?: ReactNode;
};

export default function AdminFormSection({ children, description = '', eyebrow = '', title = '' }: AdminFormSectionProps) {
  return (
    <AdminCard className="admin-form-section admin-spotlight" variant="card">
      {eyebrow ? <p className="admin-form-section__eyebrow">{eyebrow}</p> : null}
      {title ? <h3 className="admin-form-section__title font-headline">{title}</h3> : null}
      {description ? <p className="admin-form-section__description">{description}</p> : null}
      <div className="admin-form-section__body">{children}</div>
    </AdminCard>
  );
}
