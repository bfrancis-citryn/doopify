"use client";

import type { ButtonHTMLAttributes, ReactNode } from 'react';

function buildClassName(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  leftIcon?: ReactNode;
  loading?: boolean;
  rightIcon?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | string;
};

export default function AdminButton({
  children,
  className = '',
  disabled = false,
  leftIcon = null,
  loading = false,
  rightIcon = null,
  size = 'md',
  type = 'button',
  variant = 'secondary',
  ...props
}: AdminButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={buildClassName([
        'admin-btn',
        `admin-btn--${variant}`,
        `admin-btn--${size}`,
        loading ? 'is-loading' : '',
        className,
      ])}
      disabled={isDisabled}
      type={type}
      {...props}
    >
      {loading ? <span className="admin-btn__spinner" aria-hidden="true" /> : null}
      {leftIcon ? <span className="admin-btn__icon">{leftIcon}</span> : null}
      {children ? <span className="admin-btn__label">{children}</span> : null}
      {rightIcon ? <span className="admin-btn__icon">{rightIcon}</span> : null}
    </button>
  );
}
