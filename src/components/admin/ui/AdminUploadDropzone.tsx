"use client";

import { useRef, useState } from 'react';
import AdminButton from './AdminButton';

function buildClassName(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type AdminUploadDropzoneProps = {
  accept?: string;
  className?: string;
  description?: string;
  disabled?: boolean;
  multiple?: boolean;
  onFilesSelected?: (files: File[]) => void;
  title?: string;
};

export default function AdminUploadDropzone({
  accept = 'image/*',
  className = '',
  description = 'Drop files here or browse from your device.',
  disabled = false,
  multiple = true,
  onFilesSelected,
  title = 'Upload assets',
}: AdminUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: File[]) => {
    if (disabled || !files?.length) return;
    onFilesSelected?.(files);
  };

  return (
    <div
      className={buildClassName([
        'admin-upload-dropzone',
        isDragging ? 'is-dragging' : '',
        disabled ? 'is-disabled' : '',
        className,
      ])}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(Array.from(event.dataTransfer?.files || []));
      }}
      role="presentation"
    >
      <input
        accept={accept}
        hidden
        multiple={multiple}
        onChange={(event) => {
          handleFiles(Array.from(event.target.files || []));
          event.target.value = '';
        }}
        ref={inputRef}
        type="file"
      />
      <span className="material-symbols-outlined admin-upload-dropzone__icon" aria-hidden="true">
        cloud_upload
      </span>
      <p className="admin-upload-dropzone__title font-headline">{title}</p>
      <p className="admin-upload-dropzone__description">{description}</p>
      <AdminButton
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        size="sm"
        variant="secondary"
      >
        Choose files
      </AdminButton>
    </div>
  );
}
