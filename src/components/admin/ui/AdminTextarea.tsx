"use client";

import type { TextareaHTMLAttributes } from 'react';

type AdminTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function AdminTextarea({ className = '', ...props }: AdminTextareaProps) {
  return <textarea className={`admin-textarea ${className}`.trim()} {...props} />;
}
