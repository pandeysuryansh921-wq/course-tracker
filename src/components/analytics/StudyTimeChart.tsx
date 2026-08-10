'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { StudySession } from '@/types/journal';
import { Course } from '@/types/curriculum';
import { format, subDays, startOfDay, parseISO } from 'date-fns';

interface StudyTimeChartProps {
  sessions: StudySession[];
  courses: Course[];
}

export default function StudyTimeChart({ sessions, courses }: StudyTimeChartProps) {
  const [activeTab, setActiveTab] = useState<'byDay' | 'byCourse'>('byDay');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  if (!sessions || sessions.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-full flex flex-col items-center justify-center text-center min-h-[300px]">
        <p className="text-slate-500 dark:text-slate-400">No study sessions recorded yet.</p>
      </div>
    );
  }

  const textColor = isDarkMode ? '#cbd5e1' : '#475569';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

  // Process data for By Day (last 7 days)
  const generateLast7DaysData = () => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 7 }).map((_, i) => subDays(today, 6 - i));
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const daySessions = sessions.filter(s => {
        const sessionDate = startOfDay(new Date(s.startedAt));
        return format(sessionDate, 'yyyy-MM-dd') === dayStr;
      });
      
      const totalSeconds = daySessions.reduce((acc, session) => acc + session.duration, 0);
      const hours = Number((totalSeconds / 3600).toFixed(2));
      
      return {
        date: format(day, 'EEE'), // Mon, Tue, etc.
        fullDate: format(day, 'MMM dd'),
        hours,
      };
    });
  };

  // Process data for By Course
  const generateCourseData = () => {
    const courseTimeMap = sessions.reduce((acc, session) => {
      if (session.courseId) {
        if (!acc[session.courseId]) {
          acc[session.courseId] = 0;
        }
        acc[session.courseId] += session.duration;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(courseTimeMap)
      .map(([courseId, durationSeconds]) => {
        const course = courses.find(c => c.id === courseId);
        return {
          name: course ? course.name.substring(0, 15) + (course.name.length > 15 ? '...' : '') : 'Unknown',
          fullName: course ? course.name : 'Unknown Course',
          hours: Number((durationSeconds / 3600).toFixed(2)),
        };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5); // Top 5 courses
  };

  const dayData = generateLast7DaysData();
  const courseData = generateCourseData();

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Study Time</h3>
        <div className="flex space-x-2 mt-4 sm:mt-0 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('byDay')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'byDay'
                ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setActiveTab('byCourse')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'byCourse'
                ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            By Course
          </button>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === 'byDay' ? (
            <BarChart data={dayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="date" stroke={textColor} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={textColor} fontSize={12} tickLine={false} axisLine={false} allowDecimals={true} tickFormatter={(val) => val.toFixed(1)} />
              <Tooltip
                cursor={{ fill: isDarkMode ? '#334155' : '#f1f5f9' }}
                contentStyle={{
                  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                  color: isDarkMode ? '#f8fafc' : '#0f172a',
                  borderRadius: '0.5rem',
                }}
                labelFormatter={(value, entry) => entry?.[0]?.payload?.fullDate || value}
              />
              <Bar dataKey="hours" name="Hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <BarChart data={courseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" stroke={textColor} fontSize={10} tickLine={false} axisLine={false} interval={0} />
              <YAxis stroke={textColor} fontSize={12} tickLine={false} axisLine={false} allowDecimals={true} tickFormatter={(val) => val.toFixed(1)} />
              <Tooltip
                cursor={{ fill: isDarkMode ? '#334155' : '#f1f5f9' }}
                contentStyle={{
                  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                  color: isDarkMode ? '#f8fafc' : '#0f172a',
                  borderRadius: '0.5rem',
                }}
                labelFormatter={(value, entry) => entry?.[0]?.payload?.fullName || value}
              />
              <Bar dataKey="hours" name="Hours" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
