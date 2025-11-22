"use client";

import { ReactNode } from "react";
import { FieldError } from "react-hook-form";

interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: FieldError;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export default function FormField({
  label,
  required = false,
  error,
  hint,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {children}

      {hint && !error && (
        <p className="mt-1.5 text-sm text-gray-500">{hint}</p>
      )}

      {error && (
        <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
          <span>⚠</span>
          <span>{error.message}</span>
        </p>
      )}
    </div>
  );
}

