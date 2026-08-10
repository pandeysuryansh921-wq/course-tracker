'use client';

import { useEffect, useState } from 'react';
import { useTimerStore } from '@/stores/useTimerStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { formatDuration, formatDateTime } from '@/lib/utils';
import { Timer as TimerIcon, Clock, Filter, BookOpen } from 'lucide-react';
import { StudySession } from '@/types/journal';

export default function SessionLog() {
  const { getSessions } = useTimerStore();
  const { courses, topics } = useCurriculumStore();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [filterCourseId, setFilterCourseId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSessions = async () => {
      setIsLoading(true);
      try {
        await getSessions();
        // Set sessions from state, wait for store update
        const stateSessions = useTimerStore.getState().sessions;
        setSessions([...stateSessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
      } catch (error) {
        console.error('Failed to load sessions', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSessions();
  }, [getSessions]);

  const filteredSessions = filterCourseId 
    ? sessions.filter(s => s.courseId === filterCourseId)
    : sessions;

  const totalTimeToday = sessions
    .filter(s => new Date(s.startedAt).toDateString() === new Date().toDateString())
    .reduce((acc, curr) => acc + curr.duration, 0);

  const totalTimeWeek = sessions
    .filter(s => {
      const date = new Date(s.startedAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays <= 7;
    })
    .reduce((acc, curr) => acc + curr.duration, 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-violet-500" />
          Study Sessions
        </h2>
        
        <div className="relative w-full sm:w-auto">
          <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value)}
            className="w-full sm:w-48 pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All Courses</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Today</div>
          <div className="text-xl font-semibold text-slate-800 dark:text-white">{formatDuration(totalTimeToday)}</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">This Week</div>
          <div className="text-xl font-semibold text-slate-800 dark:text-white">{formatDuration(totalTimeWeek)}</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Sessions</div>
          <div className="text-xl font-semibold text-slate-800 dark:text-white">{sessions.length}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 backdrop-blur-sm">
            <tr>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Topic</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Course</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">Loading sessions...</td>
              </tr>
            ) : filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">No sessions recorded yet. Start studying!</td>
              </tr>
            ) : (
              filteredSessions.map((session) => (
                <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">
                    {formatDateTime(new Date(session.startedAt))}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm font-medium text-slate-800 dark:text-white truncate max-w-[200px]">
                      {session.topicName || (session.topicId ? topics.find(t => t.id === session.topicId)?.name : null) || 'General Study'}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                      {session.type === 'pomodoro' ? <TimerIcon className="w-3 h-3 text-violet-500" /> : <Clock className="w-3 h-3 text-cyan-500" />}
                      <span className="capitalize">{session.type}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 hidden md:table-cell truncate max-w-[150px]">
                    {session.courseName || courses.find(c => c.id === session.courseId)?.name || '-'}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-slate-800 dark:text-white text-right">
                    {formatDuration(session.duration)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
