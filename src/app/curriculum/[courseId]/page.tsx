'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import AddModuleModal from '@/components/curriculum/AddModuleModal';
import AddTopicModal from '@/components/curriculum/AddTopicModal';
import ModuleAccordion from '@/components/curriculum/ModuleAccordion';
import GeminiGemCard from '@/components/curriculum/GeminiGemCard';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ArrowLeft, Plus, Edit2, CheckCircle2 } from 'lucide-react';
import * as Icons from 'lucide-react';

export default function CourseDetailsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const courseId = resolvedParams.courseId;

  const [isAddModuleModalOpen, setIsAddModuleModalOpen] = useState(false);
  const [isAddTopicModalOpen, setIsAddTopicModalOpen] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [isEditMode, setIsEditMode] = useState(false);

  // ── Stable selectors ──────────────────────────────────────────────
  // Select raw arrays from the store — these are referentially stable
  // as long as the underlying arrays haven't changed.
  const course = useCurriculumStore(
    (state) => state.courses.find((c) => c.id === courseId)
  );
  const allModules = useCurriculumStore((state) => state.modules);
  const allTopics = useCurriculumStore((state) => state.topics);

  // Derive filtered/sorted data with useMemo so we get stable references
  // between renders when the source arrays haven't changed.
  const modules = useMemo(
    () =>
      allModules
        .filter((m) => m.courseId === courseId)
        .sort((a, b) => a.order - b.order),
    [allModules, courseId]
  );

  const topics = useMemo(
    () => allTopics.filter((t) => t.courseId === courseId),
    [allTopics, courseId]
  );

  const progress = useMemo(() => {
    if (topics.length === 0) return 0;
    const completed = topics.filter((t) => t.status === 'completed').length;
    return Math.round((completed / topics.length) * 100);
  }, [topics]);

  // ── Redirect if course not found ──────────────────────────────────
  useEffect(() => {
    if (!course) {
      router.push('/curriculum');
    }
  }, [course, router]);

  if (!course) return null;

  const IconComponent = (Icons as any)[course.icon] || Icons.Book;

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const handleAddTopic = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    setIsAddTopicModalOpen(true);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8">
      <Link
        href="/curriculum"
        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Curriculum
      </Link>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200 dark:border-slate-800 mb-8 relative overflow-hidden">
        <div
          className="absolute top-0 left-0 w-full h-2"
          style={{ backgroundColor: course.color || '#8b5cf6' }}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div
              className="p-4 rounded-xl flex-shrink-0"
              style={{
                backgroundColor: `${course.color || '#8b5cf6'}20`,
                color: course.color || '#8b5cf6',
              }}
            >
              <IconComponent className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {course.name}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 max-w-xl">
                {course.description}
              </p>
            </div>
          </div>

          <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Overall Progress
              </span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {progress}%
              </span>
            </div>
            <ProgressBar value={progress} className="mb-2" />
          </div>
        </div>
      </div>

      {course.gemLinks && course.gemLinks.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
            Gemini AI Tutors & Gems
          </h2>
          <div className="space-y-4">
            {course.gemLinks.map(gem => (
              <GeminiGemCard key={gem.id} gem={gem} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Course Modules
          </h2>
          <Button 
            variant={isEditMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
          >
            {isEditMode ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Done Editing</> : <><Edit2 className="w-4 h-4 mr-2" /> Edit Course</>}
          </Button>
        </div>
        {isEditMode && (
          <Button onClick={() => setIsAddModuleModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Module
          </Button>
        )}
      </div>

      {modules.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
          <p className="text-slate-500 mb-4">
            No modules added to this course yet.
          </p>
          {isEditMode ? (
            <Button
              variant="secondary"
              onClick={() => setIsAddModuleModalOpen(true)}
            >
              Create First Module
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setIsEditMode(true)}
            >
              Edit Course to Add Modules
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {modules.map((module, index) => {
            let isModuleLocked = false;
            if (!isEditMode && index > 0) {
              const prevModule = modules[index - 1];
              const prevModuleTopics = topics.filter(t => t.moduleId === prevModule.id);
              if (prevModuleTopics.length > 0) {
                isModuleLocked = prevModuleTopics.some(t => !t.isCompleted);
              }
            }
            return (
              <ModuleAccordion
                key={module.id}
                module={module}
                topics={topics.filter((t) => t.moduleId === module.id)}
                isExpanded={!!expandedModules[module.id]}
                onToggle={() => toggleModule(module.id)}
                isLocked={isModuleLocked}
                isEditMode={isEditMode}
                onAddTopic={handleAddTopic}
              />
            );
          })}
        </div>
      )}

      <AddModuleModal
        isOpen={isAddModuleModalOpen}
        onClose={() => setIsAddModuleModalOpen(false)}
        courseId={course.id}
      />
      
      <AddTopicModal
        isOpen={isAddTopicModalOpen}
        onClose={() => setIsAddTopicModalOpen(false)}
        courseId={course.id}
        moduleId={selectedModuleId}
      />
    </div>
  );
}
