'use client'

import React from 'react'
import { Clock, Trophy } from 'lucide-react'

function formatDate(dateValue: string | Date | number) {
  const d = new Date(dateValue)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 24) return `${hours || 1} hours ago`
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)
}

export function RecentActivity() {
  const recentQuizzes: any[] = [] // Empty since we removed useQuizStore and this component is no longer used.

  if (!recentQuizzes || recentQuizzes.length === 0) {
    return (
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/20">
        <div className="mb-4 rounded-full bg-slate-100 p-4 dark:bg-slate-800">
          <Clock className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-base font-medium text-slate-600 dark:text-slate-300">No recent activity yet</p>
        <p className="mt-1 text-sm text-slate-400">Complete a quiz or study session to see your progress here!</p>
      </div>
    )
  }

  return (
    <div className="h-full rounded-3xl border border-slate-200 bg-white/50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {recentQuizzes.map((quiz, index) => (
          <div key={`${quiz.quizId}-${index}`} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                <Trophy className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Quiz Completed
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {quiz.completedAt ? formatDate(quiz.completedAt.toString()) : 'Recently'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {Math.round((quiz.score / quiz.totalQuestions) * 100)}%
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Score</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
