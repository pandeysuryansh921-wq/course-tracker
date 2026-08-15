'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { importCourseFromZip } from '@/lib/exportImport';
import { Download, AlertCircle, BookOpen, Loader2 } from 'lucide-react';

interface CommunityCourse {
  id: string;
  title: string;
  author: string;
  description: string;
  filename: string;
}

interface CommunityLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LIBRARY_JSON_URL = 'https://raw.githubusercontent.com/pandeysuryansh921-wq/degree-track-library/main/courses.json';
const RAW_REPO_URL = 'https://raw.githubusercontent.com/pandeysuryansh921-wq/degree-track-library/main';

export function CommunityLibraryModal({ isOpen, onClose }: CommunityLibraryModalProps) {
  const [courses, setCourses] = useState<CommunityCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
    }
  }, [isOpen]);

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(LIBRARY_JSON_URL);
      if (!res.ok) throw new Error('Failed to fetch community courses');
      const data = await res.json();
      setCourses(data);
    } catch (err: any) {
      setError("Could not load library. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (course: CommunityCourse) => {
    try {
      setDownloadingId(course.id);
      setError(null);
      setSuccess(null);
      
      const fileUrl = `${RAW_REPO_URL}/${course.filename}`;
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Failed to download ${course.filename}`);
      
      const blob = await res.blob();
      const file = new File([blob], course.filename, { type: 'application/zip' });
      
      await importCourseFromZip(file);
      await useCurriculumStore.getState().initialize(true);
      
      setSuccess(`"${course.title}" has been successfully imported!`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(`Failed to import course: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Community Library">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-muted)]">
          Browse and download courses created by the Course Tracker community. Click "Download" to instantly import a course into your app.
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-500/10 rounded-lg border border-red-500/20">
            <AlertCircle size={16} />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 text-sm text-emerald-500 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <AlertCircle size={16} />
            <p>{success}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Loading library...</span>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            <BookOpen className="w-8 h-8 mx-auto mb-3 text-slate-400" />
            <h4 className="text-[var(--text-main)] font-medium">No courses available</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Check back later for new community uploads!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {courses.map((course) => (
              <div key={course.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-bold text-[var(--text-main)]">{course.title}</h4>
                  <span className="text-xs font-medium text-[var(--accent-color)]">by {course.author}</span>
                  <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">{course.description}</p>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => handleDownload(course)}
                    disabled={downloadingId !== null}
                    className="flex items-center justify-center gap-2 px-4 py-2 w-full sm:w-auto bg-[var(--text-main)] text-[var(--bg-main)] rounded-lg font-medium transition-transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {downloadingId === course.id ? (
                      <><Loader2 size={18} className="animate-spin" /> Downloading...</>
                    ) : (
                      <><Download size={18} /> Download</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
