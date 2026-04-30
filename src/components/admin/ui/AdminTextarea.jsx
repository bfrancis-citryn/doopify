"use client";

export default function AdminTextarea({ className = "", ...props }) {
  return <textarea className={`admin-textarea ${className}`.trim()} {...props} />;
}
