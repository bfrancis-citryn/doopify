"use client";

export default function AdminPage({ children, className = '', width = 'full' }) {
  const widthClass = width === 'max' ? 'admin-page--max' : '';
  return <div className={`admin-page ${widthClass} ${className}`.trim()}>{children}</div>;
}
