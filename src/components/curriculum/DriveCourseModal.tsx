'use client';

import React, { useState } from 'react';
import { 
  X, 
  FolderPlus, 
  Video, 
  FileText, 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink,
  Info
} from 'lucide-react';
import { extractFolderId, fetchDriveFolderHierarchy, organizeDriveFiles, aiStructureDriveFiles } from '@/lib/drive/scanner';
import { DriveScanResult } from '@/types/video';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useAIStore } from '@/stores/useAIStore';
import { useRouter } from 'next/navigation';

interface DriveCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DriveCourseModal({ isOpen, onClose }: DriveCourseModalProps) {
  const router = useRouter();
  const [folderInput, setFolderInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isAiStructuring, setIsAiStructuring] = useState(false);
  const [scanResult, setScanResult] = useState<DriveScanResult | null>(null);
  const [courseNameInput, setCourseNameInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const geminiKey = useAIStore((state) => state.keys.gemini);
  const activeModel = useAIStore((state) => state.activeModel);

  const addCourse = useCurriculumStore((state) => state.addCourse);
  const addModule = useCurriculumStore((state) => state.addModule);
  const addTopic = useCurriculumStore((state) => state.addTopic);
  const addResource = useCurriculumStore((state) => state.addResource);

  if (!isOpen) return null;

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const folderId = extractFolderId(folderInput);
    if (!folderId) {
      setError('Please enter a valid Google Drive folder link or folder ID.');
      return;
    }

    try {
      setIsScanning(true);
      setError(null);

      // Check if user provided an API key or if one exists in env / store
      const effectiveKey = apiKeyInput.trim() || process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;

      const { folderName, files, subfolders } = await fetchDriveFolderHierarchy(folderId, {
        apiKey: effectiveKey
      });

      if (files.length === 0) {
        setError('No files found in this Google Drive folder. Ensure the folder link is set to "Anyone with the link can view".');
        setIsScanning(false);
        return;
      }

      const result = organizeDriveFiles(folderName, folderId, files, subfolders);
      if (result.totalLectures === 0) {
        setError(`Found ${files.length} files, but no video files (.mp4, .mkv, .webm) were detected.`);
        setIsScanning(false);
        return;
      }

      setScanResult(result);
      setCourseNameInput(result.courseName);
      // Auto-expand first 2 modules
      const initialExp: Record<string, boolean> = {};
      result.modules.slice(0, 2).forEach((m) => {
        initialExp[m.id] = true;
      });
      setExpandedModules(initialExp);
    } catch (err: any) {
      console.error('[Drive Scan Error]', err);
      setError(err.message || 'Failed to scan Google Drive folder. Check folder link and sharing permissions.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAiStructure = async () => {
    if (!scanResult) return;
    const key = geminiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!key) {
      setError('To use AI Auto-Structuring, please configure your Gemini API Key in Settings -> AI & API Keys.');
      return;
    }

    try {
      setIsAiStructuring(true);
      setError(null);
      const enhanced = await aiStructureDriveFiles(scanResult, key, activeModel || 'gemini-2.5-flash');
      setScanResult(enhanced);
      setCourseNameInput(enhanced.courseName);
    } catch (err: any) {
      setError(err.message || 'AI structuring failed.');
    } finally {
      setIsAiStructuring(false);
    }
  };

  const toggleModule = (modId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [modId]: !prev[modId]
    }));
  };

  const handleConfirmImport = async () => {
    if (!scanResult) return;

    try {
      // 1. Create Course
      const courseTitle = courseNameInput.trim() || scanResult.courseName;
      const createdCourse = await addCourse(
        courseTitle,
        `Structured from Google Drive folder with ${scanResult.totalLectures} video lectures and ${scanResult.totalSlides} slides.`,
        '#3B82F6',
        'Video'
      );
      const courseId = createdCourse.id;

      // 2. Create Modules and Topics
      for (const mod of scanResult.modules) {
        const createdModule = await addModule(
          courseId, 
          mod.name, 
          `Module containing ${mod.lectures.length} lectures.`
        );
        const moduleId = createdModule.id;

        for (const lec of mod.lectures) {
          const createdTopic = await addTopic(
            moduleId,
            courseId,
            lec.cleanName
          );
          const topicId = createdTopic.id;

          // Add primary video resource
          await addResource(
            topicId,
            lec.cleanName,
            lec.driveUrl,
            'video',
            'PRIMARY'
          );

          // Add attached slide/PDF resource if paired
          if (lec.slidesFile) {
            await addResource(
              topicId,
              `${lec.cleanName} - Slides`,
              lec.slidesFile.webViewLink || `https://drive.google.com/file/d/${lec.slidesFile.id}/view`,
              'pdf',
              'REFERENCE'
            );
          }
        }
      }

      onClose();
      router.push(`/curriculum/course?id=${courseId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to import course into curriculum.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <FolderPlus size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Import Course from Google Drive
              </h2>
              <p className="text-xs text-slate-500">
                Scan lecture videos and slides into a structured DegreeTrack curriculum
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          
          {error && (
            <div className="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Step 1: Input Folder Link */}
          {!scanResult ? (
            <form onSubmit={handleScan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Google Drive Folder Link or ID
                </label>
                <input
                  type="text"
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-mono"
                  required
                />
                <div className="mt-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-xl flex items-start gap-2 text-[11px] text-blue-700 dark:text-blue-300">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Make sure the Google Drive folder sharing setting is set to <strong>"Anyone with the link can view"</strong> so DegreeTrack can scan the lecture hierarchy.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Google Drive API Key <span className="text-slate-400 font-normal">(Optional for public folders)</span>
                </label>
                <input
                  type="text"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy... (leave blank to use default public access)"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isScanning || !folderInput.trim()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all"
                >
                  {isScanning ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Scanning Folder Hierarchy...
                    </>
                  ) : (
                    'Scan Folder & Detect Lectures'
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Step 2: Preview & Structure Detected Course */
            <div className="space-y-4">
              {/* Course Title input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Course Title
                </label>
                <input
                  type="text"
                  value={courseNameInput}
                  onChange={(e) => setCourseNameInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-bold"
                />
              </div>

              {/* Stats Bar */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <Video size={14} /> {scanResult.totalLectures} Lectures Detected
                  </span>
                  {scanResult.totalSlides > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                      <FileText size={14} /> {scanResult.totalSlides} Attached Slides
                    </span>
                  )}
                  <span className="text-slate-400">
                    • {scanResult.modules.length} Modules
                  </span>
                </div>

                {/* AI Structuring Button */}
                <button
                  type="button"
                  onClick={handleAiStructure}
                  disabled={isAiStructuring}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm disabled:opacity-50 transition-all"
                  title="Use Gemini AI to polish lecture titles and organize into smart modules"
                >
                  {isAiStructuring ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Structuring...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} /> Clean & Structure with AI
                    </>
                  )}
                </button>
              </div>

              {/* Modules & Topics Tree */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {scanResult.modules.map((mod) => (
                  <div
                    key={mod.id}
                    className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50"
                  >
                    <button
                      type="button"
                      onClick={() => toggleModule(mod.id)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedModules[mod.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {mod.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {mod.lectures.length} lectures
                      </span>
                    </button>

                    {expandedModules[mod.id] && (
                      <div className="p-2.5 space-y-1.5 border-t border-slate-100 dark:border-slate-700/60">
                        {mod.lectures.map((lec) => (
                          <div
                            key={lec.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-slate-900/40 text-xs"
                          >
                            <div className="flex items-center gap-2 overflow-hidden pr-2">
                              <span className="w-5 text-center font-mono text-[10px] text-slate-400">
                                {lec.sequenceNumber !== 9999 ? lec.sequenceNumber : '•'}
                              </span>
                              <span className="text-slate-800 dark:text-slate-200 font-medium truncate">
                                {lec.cleanName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {lec.slidesFile && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium">
                                  <FileText size={10} /> PDF
                                </span>
                              )}
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                                <Video size={10} /> Video
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setScanResult(null)}
                  className="flex-1 py-2 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  Scan Another Folder
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                >
                  <CheckCircle2 size={15} /> Import as DegreeTrack Course
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
