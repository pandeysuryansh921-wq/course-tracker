'use client';
import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  showLabel?: boolean;
  striped?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  color = 'bg-gradient-to-r from-violet-500 to-primary',
  showLabel = false,
  striped = false,
  className = ''
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4'
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1 text-sm font-medium text-[var(--text-main)]">
          <span>Progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`w-full bg-muted dark:bg-slate-800 rounded-full overflow-hidden border border-border ${sizes[size]}`}>
        <div 
          className={`h-full rounded-full transition-all duration-500 ease-out ${color.startsWith('#') || color.startsWith('rgb') ? '' : color} ${striped ? 'bg-[length:1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] animate-[background-position_1s_linear_infinite]' : ''}`}
          style={{ 
            width: `${percentage}%`,
            ...(color.startsWith('#') || color.startsWith('rgb') ? { backgroundColor: color } : {})
          }}
        />
      </div>
    </div>
  );
}
