"use client";

export default function AdminInput({ className = "", ...props }) {
  return <input className={`admin-input ${className}`.trim()} {...props} />;
}
