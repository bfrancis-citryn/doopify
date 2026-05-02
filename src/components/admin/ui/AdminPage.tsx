"use client";

import type { ReactNode } from 'react';

type AdminPageProps = {
  children?: ReactNode;
  className?: string;
  width?: 'full' | 'max' | string;
};

export default function AdminPage({ children, className = '', width = 'full' }: AdminPageProps) {
  const widthClass = width === 'max' ? 'admin-page--max' : '';
  return <div className={`admin-page ${widthClass} ${className}`.trim()}>{children}</div>;
}
