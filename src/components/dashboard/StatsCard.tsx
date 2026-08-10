'use client'

import React from 'react'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  color?: 'violet' | 'cyan' | 'green' | 'orange' | 'blue'
}

const colorClasses = {
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
  cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'violet',
}: StatsCardProps) {
  const iconColorClass = colorClasses[color]

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/50 p-6 shadow-sm ring-1 ring-slate-200 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:bg-slate-900/50 dark:ring-slate-800 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconColorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <div className="flex items-center text-sm">
            {trend === 'up' && <TrendingUp className="mr-1 h-4 w-4 text-green-500" />}
            {trend === 'down' && <TrendingDown className="mr-1 h-4 w-4 text-red-500" />}
            {trend === 'neutral' && <Minus className="mr-1 h-4 w-4 text-slate-500" />}
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
