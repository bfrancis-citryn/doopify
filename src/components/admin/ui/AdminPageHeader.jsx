"use client";

export default function AdminPageHeader({ actions = null, description = '', eyebrow = '', title = '' }) {
  return (
    <header className="admin-page-header">
      <div>
        {eyebrow ? <p className="admin-page-header__eyebrow">{eyebrow}</p> : null}
        {title ? <h1 className="admin-page-header__title font-headline">{title}</h1> : null}
        {description ? <p className="admin-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="admin-page-header__actions">{actions}</div> : null}
    </header>
  );
}
