'use client';

import React, { useState, useMemo } from 'react';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import CourseCard from '@/components/curriculum/CourseCard';
import AddCourseModal from '@/components/curriculum/AddCourseModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Search, BookOpen } from 'lucide-react';

export default function CurriculumPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const courses = useCurriculumStore(state => state.courses);
  const modules = useCurriculumStore(state => state.modules);
  const topics = useCurriculumStore(state => state.topics);
  const getCourseProgress = useCurriculumStore(state => state.getCourseProgress);

  const filteredCourses = useMemo(() => {
    return courses.filter(course => 
      course.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      course.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [courses, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Curriculum</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your courses, modules, and study topics.</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="shrink-0">
          <Plus className="w-5 h-5 mr-2" /> Add Course
        </Button>
      </div>

      <div className="mb-8 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <Input
          type="text"
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 w-full max-w-md"
        />
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-20 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-10 h-10 text-indigo-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No courses yet</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8">
            Get started by adding your first course. You can break it down into modules and track your progress.
          </p>
          <Button onClick={() => setIsAddModalOpen(true)}>
            Add Your First Course
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map(course => {
            const courseModules = modules.filter(m => m.courseId === course.id);
            const courseTopics = topics.filter(t => t.courseId === course.id);
            return (
              <CourseCard 
                key={course.id} 
                course={course} 
                progress={getCourseProgress(course.id)} 
                moduleCount={courseModules.length} 
                topicCount={courseTopics.length} 
              />
            );
          })}
          {filteredCourses.length === 0 && searchQuery && (
            <div className="col-span-full text-center py-12 text-slate-500">
              No courses found matching "{searchQuery}".
            </div>
          )}
        </div>
      )}

      <AddCourseModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}
