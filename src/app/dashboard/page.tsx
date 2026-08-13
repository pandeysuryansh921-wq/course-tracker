'use client'

import React, { useState, useEffect } from 'react'
import { ProgressRing } from '@/components/dashboard/ProgressRing'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { useCurriculumStore } from '@/stores/useCurriculumStore'
import { useTimerStore } from '@/stores/useTimerStore'
import { BookOpen, CheckCircle, Flame, Calendar, Play, Plus, Clock } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { courses, topics, updateCourse, modules } = useCurriculumStore()
  const sessions = useTimerStore(state => state.sessions)
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')

  // Set first course as default when courses load
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id)
    }
  }, [courses, selectedCourseId])

  const activeCourse = courses.find(c => c.id === selectedCourseId)

  // Filter topics for selected course
  const courseTopics = topics ? topics.filter(t => t.courseId === selectedCourseId) : []
  const completedTopics = courseTopics.filter(t => t.isCompleted).length
  const overallProgress = courseTopics.length > 0 ? Math.round((completedTopics / courseTopics.length) * 100) : 0
  const dueForReview = courseTopics.filter(t => t.status === 'needs-review').slice(0, 5)

  // Calculate Streak
  let studyStreak = 0;
  if (sessions.length > 0) {
    const dates = sessions
      .map(s => new Date(s.startedAt).toISOString().split('T')[0])
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
    
    let currentDate = new Date(todayStr);
    
    if (dates.includes(todayStr)) {
      studyStreak = 1;
      let checkDate = new Date(todayStr);
      for (let i = 1; i < dates.length; i++) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (dates.includes(checkDate.toISOString().split('T')[0])) {
          studyStreak++;
        } else {
          break;
        }
      }
    } else if (dates.includes(yesterdayStr)) {
      studyStreak = 1;
      let checkDate = new Date(yesterdayStr);
      for (let i = 1; i < dates.length; i++) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (dates.includes(checkDate.toISOString().split('T')[0])) {
          studyStreak++;
        } else {
          break;
        }
      }
    }
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeCourse) {
      const dateStr = e.target.value;
      const targetDate = dateStr ? new Date(dateStr) : undefined;
      updateCourse(activeCourse.id, { targetCompletionDate: targetDate });
    }
  };

  const getDaysRemaining = () => {
    if (!activeCourse?.targetCompletionDate) return null;
    const target = new Date(activeCourse.targetCompletionDate);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days;
  };

  if (courses.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/50 text-center dark:border-slate-800 dark:bg-slate-900/50">
        <BookOpen className="mb-4 h-12 w-12 text-violet-500 opacity-50" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">No Courses Yet</h2>
        <p className="mt-2 text-slate-500 max-w-md">Please create or select a course to view its specific dashboard and track your progress.</p>
        <Link href="/curriculum" className="mt-6 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700">
          Create a Course
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          {courses.map(course => (
            <option key={course.id} value={course.id}>{course.name}</option>
          ))}
        </select>
      </div>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-cyan-600 p-8 text-white shadow-lg">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
          <p className="mt-2 text-violet-100 max-w-xl">
            You're making great progress. Keep up the momentum and tackle those review topics today!
          </p>
        </div>
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-0 right-32 mb-16 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl"></div>
      </div>

      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <h2 className="mb-6 text-lg font-semibold text-slate-700 dark:text-slate-300">Overall Progress</h2>
          <ProgressRing progress={overallProgress} size={160} strokeWidth={14} />
        </div>
        
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard
            title={activeCourse ? "Total Modules" : "Total Courses"}
            value={activeCourse ? modules.filter(m => m.courseId === activeCourse.id).length : courses.length}
            icon={BookOpen}
            color="violet"
          />
          <StatsCard
            title="Completed Topics"
            value={completedTopics}
            icon={CheckCircle}
            color="green"
            trend="up"
          />
          <StatsCard
            title="Study Streak"
            value={studyStreak.toString()}
            subtitle="Days"
            icon={Flame}
            color="orange"
          />
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-cyan-100 p-2.5 dark:bg-cyan-500/20">
                <Calendar className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Target Date</p>
            </div>
            <div className="mt-4 flex flex-col gap-1">
               <input 
                 type="date" 
                 value={activeCourse?.targetCompletionDate ? new Date(activeCourse.targetCompletionDate).toISOString().split('T')[0] : ''} 
                 onChange={handleDateChange}
                 className="bg-transparent border-none text-xl font-bold text-slate-900 dark:text-white focus:ring-0 p-0 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer w-full rounded outline-none"
               />
               <span className="text-sm text-slate-500">
                 {getDaysRemaining() !== null ? (getDaysRemaining()! >= 0 ? `${getDaysRemaining()} days remaining` : 'Overdue') : 'Set a target date'}
               </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Due for Review</h2>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 dark:bg-orange-500/20 dark:text-orange-400">
              {dueForReview.length} Topics
            </span>
          </div>
          
          {dueForReview.length > 0 ? (
            <div className="space-y-4">
              {dueForReview.map(topic => (
                <div key={topic.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:bg-slate-100 dark:border-slate-800/50 dark:bg-slate-800/50 dark:hover:bg-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{topic.name}</span>
                  </div>
                  <Link href={`/curriculum/course?id=${selectedCourseId}`} className="text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400">
                    Review
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center dark:border-slate-800 dark:bg-slate-800/20">
              <CheckCircle className="mb-3 h-8 w-8 text-green-500 opacity-80" />
              <p className="text-base font-medium text-slate-600 dark:text-slate-300">All caught up!</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">You have no pending topics to review.</p>
            </div>
          )}
        </div>
        
        <div>
          {/* Recent Activity removed as part of API-free migration */}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/curriculum" className="group flex items-center space-x-4 rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-violet-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-violet-700">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 group-hover:bg-violet-200 dark:bg-violet-500/20 dark:group-hover:bg-violet-500/30">
            <BookOpen className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Curriculum</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage your learning</p>
          </div>
        </Link>
        
        <button className="group flex items-center space-x-4 rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all hover:-translate-y-1 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-cyan-700">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100 group-hover:bg-cyan-200 dark:bg-cyan-500/20 dark:group-hover:bg-cyan-500/30">
            <Plus className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Add Course</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Expand your curriculum</p>
          </div>
        </button>

        <Link href="/journal" className="group flex items-center space-x-4 rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-green-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-green-700">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 group-hover:bg-green-200 dark:bg-green-500/20 dark:group-hover:bg-green-500/30">
            <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Study Timer</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Focus on a session</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
