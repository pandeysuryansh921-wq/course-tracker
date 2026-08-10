'use client'

import React, { useEffect, useState } from 'react'

interface ProgressRingProps {
  progress?: number
  size?: number
  strokeWidth?: number
  color?: string
  subtitle?: string
}

export function ProgressRing({
  progress = 0,
  size = 180,
  strokeWidth = 12,
  color = 'violet',
  subtitle = 'Completed',
}: ProgressRingProps) {
  const [offset, setOffset] = useState(0)
  const center = size / 2
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    const progressOffset = ((100 - progress) / 100) * circumference
    const timer = setTimeout(() => {
        setOffset(progressOffset)
    }, 100)
    return () => clearTimeout(timer)
  }, [circumference, progress])
  
  const [initialRender, setInitialRender] = useState(true)
  useEffect(() => {
      setInitialRender(false)
  }, [])

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          className="stroke-slate-200 dark:stroke-slate-700"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={initialRender ? circumference : offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-bold text-slate-800 dark:text-white">
          {progress}%
        </span>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {subtitle}
        </span>
      </div>
    </div>
  )
}
