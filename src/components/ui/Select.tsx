'use client';
import React, { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { label: string; value: string | number }[];
}

export function Select({ label, error, options, className = '', ...props }: SelectProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-[var(--text-main)]">{label}</label>}
      <div className="relative">
        <select
          className={`w-full appearance-none rounded-lg border bg-card px-4 py-2 text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
            error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary'
          }`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)]">
          <ChevronDown size={16} />
        </div>
      </div>
      {error && <span className="text-xs text-danger mt-1 animate-fade-in">{error}</span>}
    </div>
  );
}
