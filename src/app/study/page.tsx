'use client';

import React, { useMemo } from 'react';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { DagProcessor } from '@/lib/dag';
import { Target, Lock, PlayCircle, BookOpen, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Topic } from '@/types/curriculum';
import KnowledgeMap from '@/components/study/KnowledgeMap';

export default function StudyEnginePage() {
  const topics = useCurriculumStore(state => state.topics);
  const courses = useCurriculumStore(state => state.courses);
  const getCourseModules = useCurriculumStore(state => state.getCourseModules);

  // Re-run the DAG algorithm when topics change
  const dag = useMemo(() => new DagProcessor(topics), [topics]);
  
  const nextUp = dag.getNextUp();
  const blocked = dag.getBlockedTopics();
  
  const getTopicContext = (topic: Topic) => {
    const course = courses.find(c => c.id === topic.courseId);
    return { course };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-xl">
          <Target className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Study Engine</h1>
          <p className="text-slate-500 dark:text-slate-400">Your optimal learning path based on prerequisite unblocking.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-emerald-500" />
            Next Up / Unlocked
          </h2>
          
          {nextUp.length === 0 ? (
            <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-500">
              No topics available. You might have finished everything or you need to add more courses!
            </div>
          ) : (
            <div className="space-y-4">
              {nextUp.map(topic => {
                const { course } = getTopicContext(topic);
                return (
                  <div key={topic.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          <span className="text-violet-600 dark:text-violet-400">{course?.name}</span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400">High Priority</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{topic.name}</h3>
                        {topic.description && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">{topic.description}</p>
                        )}
                      </div>
                      <Link 
                        href={`/curriculum/course?id=${topic.courseId}#topic-${topic.id}`}
                        className="bg-slate-100 dark:bg-slate-700 hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-900/50 dark:hover:text-violet-300 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                      >
                        Study Now
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-400" />
            Locked (Needs Prereqs)
          </h2>
          
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
            {blocked.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No blocked topics.</p>
            ) : (
              <div className="space-y-3">
                {blocked.slice(0, 5).map(topic => (
                  <div key={topic.id} className="flex flex-col gap-1 pb-3 border-b border-slate-100 dark:border-slate-700 last:border-0 last:pb-0">
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-sm line-clamp-1">{topic.name}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Requires: {topic.prerequisites?.join(', ')}
                    </span>
                  </div>
                ))}
                {blocked.length > 5 && (
                  <p className="text-xs text-center text-slate-500 pt-2">
                    + {blocked.length - 5} more blocked topics
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Target className="w-5 h-5 text-violet-500" />
          Knowledge Map
        </h2>
        <KnowledgeMap dagNodes={dag.getRawNodes()} />
      </div>
    </div>
  );
}

