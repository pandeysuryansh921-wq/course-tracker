'use client';
import React, { TextareaHTMLAttributes, useState } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  maxLength?: number;
}

export function TextArea({ label, error, maxLength, className = '', onChange, ...props }: TextAreaProps) {
  const [charCount, setCharCount] = useState(0);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCharCount(e.target.value.length);
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-[var(--text-main)]">{label}</label>}
      <textarea
        className={`w-full rounded-lg border bg-card px-4 py-3 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors min-h-[100px] resize-y ${
          error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary'
        }`}
        onChange={handleChange}
        maxLength={maxLength}
        {...props}
      />
      <div className="flex justify-between mt-1 text-xs">
        <span className="text-danger animate-fade-in">{error || ''}</span>
        {maxLength && (
          <span className="text-[var(--text-muted)]">
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
