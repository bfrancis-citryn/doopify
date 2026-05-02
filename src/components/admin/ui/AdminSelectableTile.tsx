"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

function buildClassName(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type AdminSelectableTileProps = {
  action?: ReactNode;
  className?: string;
  disabled?: boolean;
  footer?: ReactNode;
  media?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  subtitle?: ReactNode;
  title?: ReactNode;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
} & Omit<HTMLAttributes<HTMLDivElement | HTMLButtonElement>, 'title' | 'onClick'>;

export default function AdminSelectableTile({
  action,
  className = '',
  disabled = false,
  footer,
  media,
  onClick,
  selected = false,
  subtitle,
  title,
  type = 'button',
  ...props
}: AdminSelectableTileProps) {
  const classNames = buildClassName([
    'admin-selectable-tile',
    selected ? 'is-selected' : '',
    onClick ? 'is-clickable' : '',
    className,
  ]);

  const content = (
    <>
      {media ? (
        <div className="admin-selectable-tile__media">
          {media}
          {selected ? (
            <span className="admin-selectable-tile__check" aria-hidden="true">
              <span className="material-symbols-outlined">check</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {title || subtitle ? (
        <div className="admin-selectable-tile__copy">
          {title ? <p className="admin-selectable-tile__title">{title}</p> : null}
          {subtitle ? <p className="admin-selectable-tile__subtitle">{subtitle}</p> : null}
        </div>
      ) : null}

      {footer ? <div className="admin-selectable-tile__footer">{footer}</div> : null}
      {action ? <div className="admin-selectable-tile__action">{action}</div> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        className={classNames}
        disabled={disabled}
        onClick={onClick}
        type={type}
        {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={classNames} {...(props as HTMLAttributes<HTMLDivElement>)}>
      {content}
    </div>
  );
}
