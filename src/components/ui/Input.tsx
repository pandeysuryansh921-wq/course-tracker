'use client';
import React, { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({ label, error, icon, className = '', ...props }: InputProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-[var(--text-main)]">{label}</label>}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 text-[var(--text-muted)]">
            {icon}
          </div>
        )}
        <input
          className={`w-full rounded-lg border bg-card py-2 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${icon ? 'pl-10' : 'pl-4'} pr-4 ${
            error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary'
          }`}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-danger mt-1 animate-fade-in">{error}</span>}
    </div>
  );
}
