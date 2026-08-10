'use client';

import { Course } from '@/types/curriculum';
import * as Icons from 'lucide-react';
import Link from 'next/link';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Trash2 } from 'lucide-react';

interface CourseCardProps {
  course: Course;
  progress: number;
  moduleCount: number;
  topicCount: number;
}

export default function CourseCard({ course, progress, moduleCount, topicCount }: CourseCardProps) {
  const deleteCourse = useCurriculumStore(state => state.deleteCourse);
  const IconComponent = (Icons as any)[course.icon] || Icons.Book;

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this course?')) {
      deleteCourse(course.id);
    }
  };

  return (
    <Link href={`/curriculum/${course.id}`} className="block">
      <div 
        className="relative p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden group"
        style={{ borderTop: `4px solid ${course.color || '#8b5cf6'}` }}
      >
        <button
          onClick={handleDelete}
          className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div 
            className="p-3 rounded-lg"
            style={{ backgroundColor: `${course.color || '#8b5cf6'}20`, color: course.color || '#8b5cf6' }}
          >
            <IconComponent className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-slate-900 dark:text-white line-clamp-1">{course.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{course.description}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{moduleCount} Modules &bull; {topicCount} Topics</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <ProgressBar value={progress} color={course.color || '#8b5cf6'} />
        </div>
      </div>
    </Link>
  );
}
