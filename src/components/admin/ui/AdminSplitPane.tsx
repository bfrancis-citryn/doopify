"use client";

import type { ReactNode } from 'react';

type AdminSplitPaneProps = {
  children?: ReactNode;
  className?: string;
  detail?: ReactNode;
  list?: ReactNode;
};

export default function AdminSplitPane({ children, className = '', detail = null, list = null }: AdminSplitPaneProps) {
  if (children) {
    return <div className={`admin-split-pane ${className}`.trim()}>{children}</div>;
  }

  return (
    <div className={`admin-split-pane ${className}`.trim()}>
      <div className="admin-split-pane__list">{list}</div>
      <div className="admin-split-pane__detail">{detail}</div>
    </div>
  );
}
