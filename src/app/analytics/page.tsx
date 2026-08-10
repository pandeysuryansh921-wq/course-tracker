'use client';

import React, { useEffect, useState } from 'react';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useTimerStore } from '@/stores/useTimerStore';
import { TrendingUp, Award, BarChart3, Target, Brain } from 'lucide-react';
import PerformanceChart from '@/components/analytics/PerformanceChart';
import StudyTimeChart from '@/components/analytics/StudyTimeChart';
import WeakSpotList from '@/components/analytics/WeakSpotList';

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const { courses, topics } = useCurriculumStore();
  const sessions = useTimerStore((state) => state.sessions);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  // Filter based on selected course
  const filteredTopics = selectedCourseId === 'all' 
    ? topics 
    : topics.filter(t => t.courseId === selectedCourseId);
    
  const filteredSessions = selectedCourseId === 'all'
    ? sessions
    : sessions.filter(s => s.courseId === selectedCourseId);

  // Calculate summary stats
  const topicsWithQuizzes = filteredTopics.filter(t => t.quizScore !== undefined);
  const totalQuizzes = topicsWithQuizzes.length;
  
  const avgScore = totalQuizzes > 0 
    ? Math.round(topicsWithQuizzes.reduce((acc, curr) => acc + ((curr.quizScore || 0) / (curr.quizMaxScore || 100) * 100), 0) / totalQuizzes)
    : 0;
    
  const totalStudySeconds = filteredSessions.reduce((acc, curr) => acc + curr.duration, 0);
  const totalStudyMinutes = totalStudySeconds / 60;
  const studyTimeDisplay = totalStudyMinutes < 60 
    ? `${Math.round(totalStudyMinutes)}m` 
    : `${(totalStudySeconds / 3600).toFixed(1)}h`;

  const masteredTopicsCount = filteredTopics.filter(topic => topic.isMastered).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
          <BarChart3 className="w-6 h-6 mr-2 text-violet-600 dark:text-violet-400" />
          Analytics & Insights
        </h1>
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Course:</span>
          <select 
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg focus:ring-violet-500 focus:border-violet-500 block p-2"
          >
            <option value="all">All Courses</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
          <div className="p-3 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 mr-4">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Quizzes</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalQuizzes}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
          <div className="p-3 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 mr-4">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Average Score</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{avgScore}%</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mr-4">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Study Time</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{studyTimeDisplay}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
          <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mr-4">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Topics Mastered</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{masteredTopicsCount}</p>
          </div>
        </div>
      </div>

      {/* Main Performance Chart */}
      <div className="w-full">
        <PerformanceChart courses={courses} selectedCourseId={selectedCourseId} />
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StudyTimeChart sessions={filteredSessions} courses={courses} />
        <WeakSpotList topics={filteredTopics} courses={courses} />
      </div>
    </div>
  );
}
