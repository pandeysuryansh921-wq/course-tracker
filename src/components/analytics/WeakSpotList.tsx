'use client';

import React from 'react';
import { Topic, Course } from '@/types/curriculum';
import { QuizResult } from '@/types/quiz';
import { AlertTriangle, Target, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface WeakSpotListProps {
  topics: Topic[];
  courses: Course[];
}

export default function WeakSpotList({ topics, courses }: WeakSpotListProps) {
  // Find topics that need review
  const weakSpots = topics
    .map(topic => {
      const course = courses.find(c => c.id === topic.courseId);
      
      const latestScore = topic.quizScore !== undefined ? topic.quizScore : null;
      const daysSinceQuiz = null; // Removed as part of API-free migration

      const needsReview = topic.status === 'needs-review' || 
                         (latestScore !== null && latestScore < 70) ||
                         (topic.nextReviewDate && new Date(topic.nextReviewDate) < new Date());

      return {
        topic,
        courseName: course ? course.name : 'Unknown Course',
        latestScore,
        daysSinceQuiz,
        needsReview
      };
    })
    .filter(item => item.needsReview)
    .sort((a, b) => {
      // Sort by score ascending (lowest first), then by days since quiz descending
      if (a.latestScore !== null && b.latestScore !== null) {
        if (a.latestScore !== b.latestScore) return a.latestScore - b.latestScore;
      }
      if (a.daysSinceQuiz !== null && b.daysSinceQuiz !== null) {
        return b.daysSinceQuiz - a.daysSinceQuiz;
      }
      return 0;
    })
    .slice(0, 5); // Limit to top 5 weak spots

  if (weakSpots.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-full flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <Target className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No weak spots!</h3>
        <p className="text-slate-500 dark:text-slate-400">You're doing great. Keep up the good work!</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-full">
      <div className="flex items-center space-x-2 mb-6">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Topics to Review</h3>
      </div>

      <div className="space-y-4">
        {weakSpots.map(({ topic, courseName, latestScore, daysSinceQuiz }) => {
          let scoreColorClass = 'text-slate-500 dark:text-slate-400';
          let scoreBgClass = 'bg-slate-100 dark:bg-slate-700/50';
          
          if (latestScore !== null) {
            if (latestScore < 50) {
              scoreColorClass = 'text-red-600 dark:text-red-400';
              scoreBgClass = 'bg-red-50 dark:bg-red-900/20';
            } else if (latestScore < 70) {
              scoreColorClass = 'text-orange-600 dark:text-orange-400';
              scoreBgClass = 'bg-orange-50 dark:bg-orange-900/20';
            } else if (latestScore < 80) {
              scoreColorClass = 'text-yellow-600 dark:text-yellow-400';
              scoreBgClass = 'bg-yellow-50 dark:bg-yellow-900/20';
            }
          }

          return (
            <div key={topic.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 gap-4">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">{topic.name}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">{courseName}</p>
                <div className="flex items-center space-x-4 mt-2">
                  {latestScore !== null && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${scoreBgClass} ${scoreColorClass}`}>
                      Score: {latestScore}%
                    </span>
                  )}
                  {daysSinceQuiz !== null && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Last quiz: {daysSinceQuiz === 0 ? 'Today' : `${daysSinceQuiz} days ago`}
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/curriculum?courseId=${topic.courseId}`}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors whitespace-nowrap"
              >
                Review
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
