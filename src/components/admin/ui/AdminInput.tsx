"use client";

import type { InputHTMLAttributes } from 'react';

type AdminInputProps = InputHTMLAttributes<HTMLInputElement>;

export default function AdminInput({ className = '', ...props }: AdminInputProps) {
  return <input className={`admin-input ${className}`.trim()} {...props} />;
}
