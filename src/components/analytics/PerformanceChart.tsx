'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { Course } from '@/types/curriculum';

import { useCurriculumStore } from '@/stores/useCurriculumStore';

interface PerformanceChartProps {
  courses: Course[];
  selectedCourseId?: string;
}

export default function PerformanceChart({ courses, selectedCourseId = 'all' }: PerformanceChartProps) {
  const { topics } = useCurriculumStore();
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

  const filteredTopics = selectedCourseId === 'all'
    ? topics
    : topics.filter(t => t.courseId === selectedCourseId);

  const topicsWithScores = filteredTopics.filter(t => t.quizScore !== undefined);

  if (!topicsWithScores || topicsWithScores.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center h-64">
        <p className="text-slate-500 dark:text-slate-400 text-sm break-words text-center">
          No score data available yet to display performance charts for the selected scope.
        </p>
      </div>
    );
  }

  const textColor = isDarkMode ? '#cbd5e1' : '#475569';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

  let chartData: any[] = [];
  
  if (selectedCourseId === 'all') {
    // Process data for BarChart (avg score per course)
    const courseDataMap = topicsWithScores.reduce((acc, topic) => {
      const course = courses.find(c => c.id === topic.courseId);
      const courseName = course ? course.name : 'Unknown Course';
      if (!acc[courseName]) {
        acc[courseName] = { totalScore: 0, count: 0 };
      }
      acc[courseName].totalScore += (topic.quizScore! / (topic.quizMaxScore || 100)) * 100;
      acc[courseName].count += 1;
      return acc;
    }, {} as Record<string, { totalScore: number; count: number }>);

    chartData = Object.entries(courseDataMap).map(([courseName, data]) => ({
      name: courseName.length > 20 ? courseName.substring(0, 20) + '...' : courseName,
      fullName: courseName,
      score: Math.round(data.totalScore / data.count),
    }));
  } else {
    // Process data for specific course (topics vs 70% target)
    chartData = topicsWithScores.map(topic => ({
      name: topic.name.length > 20 ? topic.name.substring(0, 20) + '...' : topic.name,
      fullName: topic.name,
      score: Math.round((topic.quizScore! / (topic.quizMaxScore || 100)) * 100),
    }));
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {selectedCourseId === 'all' ? 'Average Score by Course' : 'Topic Scores vs Target'}
        </h3>
        {selectedCourseId !== 'all' && (
          <div className="mt-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
            <p className="break-words text-sm text-slate-500 dark:text-slate-400">
              The chart below breaks down your performance across individual topics in this course. A target line is set at 70% (passing score).
            </p>
          </div>
        )}
      </div>

      <div className="h-72 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke={textColor} 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              angle={-25}
              textAnchor="end"
              height={50}
            />
            <YAxis stroke={textColor} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip
              cursor={{ fill: isDarkMode ? '#334155' : '#f1f5f9' }}
              contentStyle={{
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                color: isDarkMode ? '#f8fafc' : '#0f172a',
                borderRadius: '0.5rem',
              }}
              formatter={(value: any) => [`${value}%`, 'Score']}
              labelFormatter={(label: any, payload: readonly any[]) => {
                if (payload && payload.length > 0) {
                  return payload[0].payload.fullName;
                }
                return label;
              }}
            />
            {selectedCourseId !== 'all' && (
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Target (70%)', fill: '#ef4444', fontSize: 12 }} />
            )}
            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.score >= 85 ? '#10b981' : entry.score >= 70 ? '#06b6d4' : '#f59e0b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
