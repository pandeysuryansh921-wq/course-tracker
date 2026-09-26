'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  FolderPlus, 
  Video, 
  FileText, 
  Image as ImageIcon,
  FileBox,
  Sparkles, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Lock,
  Globe
} from 'lucide-react';
import { 
  extractFolderId, 
  fetchDeterministicCourseHierarchy, 
  aiStructureDriveFiles,
  diffCourseWithDrive,
  CourseDiffResult
} from '@/lib/drive/scanner';
import { DriveScanResult } from '@/types/video';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useAIStore } from '@/stores/useAIStore';
import { 
  getCourseLibraryAccessToken, 
  getCourseLibraryUser, 
  saveCourseLibraryUser 
} from '@/lib/driveSync';
import { useRouter } from 'next/navigation';

interface DriveCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCourseId?: string; // Optional: when refreshing an existing course
}

export default function DriveCourseModal({ isOpen, onClose, existingCourseId }: DriveCourseModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'private' | 'public'>('private');
  const [folderInput, setFolderInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isAiStructuring, setIsAiStructuring] = useState(false);
  const [scanResult, setScanResult] = useState<DriveScanResult | null>(null);
  const [diffResult, setDiffResult] = useState<CourseDiffResult | null>(null);
  const [courseNameInput, setCourseNameInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [driveUser, setDriveUser] = useState<any>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ courseId: string; name: string } | null>(null);

  const geminiKey = useAIStore((state) => state.keys.gemini);
  const activeModel = useAIStore((state) => state.activeModel);

  const courses = useCurriculumStore((state) => state.courses);
  const modules = useCurriculumStore((state) => state.modules);
  const topics = useCurriculumStore((state) => state.topics);
  const resources = useCurriculumStore((state) => state.resources);

  const addCourse = useCurriculumStore((state) => state.addCourse);
  const updateCourse = useCurriculumStore((state) => state.updateCourse);
  const addModule = useCurriculumStore((state) => state.addModule);
  const addTopic = useCurriculumStore((state) => state.addTopic);
  const addResource = useCurriculumStore((state) => state.addResource);
  const updateResource = useCurriculumStore((state) => state.updateResource);

  useEffect(() => {
    if (isOpen) {
      const user = getCourseLibraryUser();
      setDriveUser(user);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnectDrive = async () => {
    try {
      setIsAuthenticating(true);
      setError(null);
      const res = await getCourseLibraryAccessToken(true);
      setDriveUser(res.user);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate with Google Drive.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleScan = async (e: React.FormEvent, forceFolderId?: string) => {
    if (e) e.preventDefault();
    const rawInput = forceFolderId || folderInput;
    const folderId = extractFolderId(rawInput);
    if (!folderId) {
      setError('Please enter a valid Google Drive folder link or folder ID.');
      return;
    }

    // Check for duplicate course import (Section 44)
    if (!existingCourseId) {
      const duplicate = courses.find((c) => c.driveFolderId === folderId);
      if (duplicate && !duplicateWarning) {
        setDuplicateWarning({ courseId: duplicate.id, name: duplicate.name });
        return;
      }
    }

    try {
      setIsScanning(true);
      setError(null);
      setDuplicateWarning(null);

      let accessToken: string | undefined = undefined;

      if (activeTab === 'private') {
        const authRes = await getCourseLibraryAccessToken();
        accessToken = authRes.token;
        if (!accessToken) {
          throw new Error('Google Drive authorization required to access private course folder.');
        }
      }

      const effectiveKey = apiKeyInput.trim() || process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;

      const result = await fetchDeterministicCourseHierarchy(folderId, {
        accessToken,
        apiKey: effectiveKey,
      });

      if (result.rawFilesCount === 0 && result.modules.length === 0) {
        setError('No files or folders found in this Google Drive course folder.');
        setIsScanning(false);
        return;
      }

      setScanResult(result);
      setCourseNameInput(result.courseName);

      // If refreshing an existing course, compute differential sync (Section 34)
      if (existingCourseId) {
        const courseResources = resources.filter((r) => r.courseId === existingCourseId);
        const courseTopics = topics.filter((t) => t.courseId === existingCourseId);
        const courseModules = modules.filter((m) => m.courseId === existingCourseId);
        const diff = diffCourseWithDrive(result, courseResources, courseTopics, courseModules);
        setDiffResult(diff);
      }

      // Auto-expand first module and topics
      const initialExpMods: Record<string, boolean> = {};
      const initialExpTops: Record<string, boolean> = {};
      if (result.modules.length > 0) {
        initialExpMods[result.modules[0].id] = true;
        result.modules[0].topics.slice(0, 3).forEach((t) => {
          initialExpTops[t.id] = true;
        });
      }
      setExpandedModules(initialExpMods);
      setExpandedTopics(initialExpTops);
    } catch (err: any) {
      console.error('[Drive Scan Error]', err);
      setError(err.message || 'Failed to scan Google Drive folder.');
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
    setExpandedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const toggleTopic = (topId: string) => {
    setExpandedTopics((prev) => ({ ...prev, [topId]: !prev[topId] }));
  };

  const handleConfirmImport = async () => {
    if (!scanResult) return;

    try {
      // 1. Create or Update Course
      const courseTitle = courseNameInput.trim() || scanResult.courseName;
      let targetCourseId = existingCourseId;

      if (!targetCourseId) {
        const createdCourse = await addCourse(
          courseTitle,
          `Google Drive course (${scanResult.totalLectures} lectures, ${scanResult.totalSlides} PDFs).`,
          '#3B82F6',
          'Video'
        );
        targetCourseId = createdCourse.id;
        await updateCourse(targetCourseId, { driveFolderId: scanResult.folderId });
      } else {
        await updateCourse(targetCourseId, { 
          name: courseTitle, 
          driveFolderId: scanResult.folderId 
        });
      }

      // 2. Course-level resources (Section 8)
      for (const r of scanResult.courseResources) {
        await addResource(
          '',
          r.cleanTitle || r.name,
          r.driveUrl,
          r.resourceType,
          'COURSE_RESOURCE',
          {
            provider: 'google-drive',
            driveFileId: r.id,
            fileSize: r.fileSize,
            mimeType: r.mimeType,
            courseId: targetCourseId,
          }
        );
      }

      // 3. Create Modules, Topics, and Resources
      for (const mod of scanResult.modules) {
        const createdModule = await addModule(
          targetCourseId,
          mod.name,
          `Module containing ${mod.topics.length} topics and ${mod.moduleResources.length} module files.`
        );
        const moduleId = createdModule.id;

        // Module-level resources (Section 7)
        for (const mr of mod.moduleResources) {
          await addResource(
            '',
            mr.cleanTitle || mr.name,
            mr.driveUrl,
            mr.resourceType,
            'MODULE_RESOURCE',
            {
              provider: 'google-drive',
              driveFileId: mr.id,
              fileSize: mr.fileSize,
              mimeType: mr.mimeType,
              courseId: targetCourseId,
              moduleId,
            }
          );
        }

        // Topics (Section 6)
        for (const top of mod.topics) {
          const createdTopic = await addTopic(
            moduleId,
            targetCourseId,
            top.name
          );
          const topicId = createdTopic.id;

          // Topic resources
          for (const res of top.resources) {
            await addResource(
              topicId,
              res.cleanTitle || res.name,
              res.driveUrl,
              res.resourceType,
              res.resourceType === 'video' ? 'PRIMARY' : 'REFERENCE',
              {
                provider: 'google-drive',
                driveFileId: res.id,
                fileSize: res.fileSize,
                mimeType: res.mimeType,
                courseId: targetCourseId,
                moduleId,
              }
            );
          }
        }
      }

      onClose();
      router.push(`/curriculum/course?id=${targetCourseId}`);
    } catch (err: any) {
      console.error('[Import Error]', err);
      setError(err.message || 'Failed to import course into curriculum.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FolderPlus size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {existingCourseId ? 'Refresh Course from Drive' : 'Import Course from Google Drive'}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Private & Secure
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Deterministic 3-tier curriculum parser (Course → Modules → Topics → Resources)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {/* Tab Toggle: Private vs Public */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('private')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'private'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Lock size={13} /> Private Google Drive (Recommended)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('public')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'public'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Globe size={13} /> Public / Shared Link (Legacy)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          
          {error && (
            <div className="p-3 text-xs bg-red-950/40 text-red-400 rounded-xl border border-red-800/80 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Duplicate Import Warning (Section 44) */}
          {duplicateWarning && (
            <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-300">
                <AlertCircle size={16} className="shrink-0 text-amber-400" />
                <div>
                  <strong className="block font-semibold">Folder already connected</strong>
                  This Google Drive folder is already linked to the existing course: &ldquo;{duplicateWarning.name}&rdquo;.
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/curriculum/course?id=${duplicateWarning.courseId}`);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
                >
                  Open Existing Course
                </button>
                <button
                  type="button"
                  onClick={(e) => handleScan(e, folderInput)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium"
                >
                  Import as Separate Copy
                </button>
              </div>
            </div>
          )}

          {/* Form Step 1: Input Folder Link */}
          {!scanResult && (
            <form onSubmit={handleScan} className="space-y-4">
              
              {/* Private Auth Banner */}
              {activeTab === 'private' && (
                <div className="p-3.5 bg-slate-800/70 border border-slate-700 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="text-emerald-400 shrink-0" size={18} />
                    <div className="text-xs">
                      {driveUser ? (
                        <div>
                          <span className="font-semibold text-white">Connected to Google Drive</span>
                          <span className="text-slate-400 block text-[11px]">{driveUser.email}</span>
                        </div>
                      ) : (
                        <div>
                          <span className="font-semibold text-white">Google Drive Authorization</span>
                          <span className="text-slate-400 block text-[11px]">
                            Authorize DegreeTrack to read your private course folders
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {!driveUser && (
                    <button
                      type="button"
                      onClick={handleConnectDrive}
                      disabled={isAuthenticating}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isAuthenticating && <Loader2 size={12} className="animate-spin" />}
                      Authorize Access
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Google Drive Folder Link or Folder ID
                </label>
                <input
                  type="text"
                  value={folderInput}
                  onChange={(e) => {
                    setFolderInput(e.target.value);
                    setDuplicateWarning(null);
                  }}
                  placeholder="https://drive.google.com/drive/folders/1ABCxyz... or 1ABCxyz..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Paste the link to your course root folder (e.g. Anatomy). DegreeTrack automatically scans Level 1 (Modules), Level 2 (Topics), and contained lectures/documents.
                </span>
              </div>

              {activeTab === 'public' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Google Drive API Key (Optional for Public Folders)
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isScanning || !folderInput.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
                >
                  {isScanning ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Scanning Course Hierarchy...
                    </>
                  ) : (
                    'Scan Course Folder'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Form Step 2: Scanned Preview */}
          {scanResult && (
            <div className="space-y-4">
              
              {/* Summary Metrics Bar (Section 11) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                <div className="p-2 bg-slate-900/60 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Modules</span>
                  <span className="text-sm font-bold text-white">{scanResult.totalModules}</span>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Topics</span>
                  <span className="text-sm font-bold text-white">{scanResult.totalTopics}</span>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Videos</span>
                  <span className="text-sm font-bold text-blue-400">{scanResult.totalLectures}</span>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">PDFs</span>
                  <span className="text-sm font-bold text-emerald-400">{scanResult.totalSlides}</span>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-lg col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Images/Other</span>
                  <span className="text-sm font-bold text-purple-400">{scanResult.totalImages + scanResult.totalOthers}</span>
                </div>
              </div>

              {/* Differential Sync Banner if applicable */}
              {diffResult && (
                <div className="p-3 bg-blue-950/40 border border-blue-800/80 rounded-xl text-xs text-blue-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={15} className="text-blue-400" />
                    <span><strong>Drive Changes:</strong> {diffResult.summary}</span>
                  </div>
                </div>
              )}

              {/* Course Title Field */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Course Title</label>
                <input
                  type="text"
                  value={courseNameInput}
                  onChange={(e) => setCourseNameInput(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Optional AI structuring */}
              <div className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
                <div className="text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-400" /> Enhance organization with AI (Optional)
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Uses Gemini to polish titles and structure. Google Drive files are never modified.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAiStructure}
                  disabled={isAiStructuring}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1 shrink-0"
                >
                  {isAiStructuring ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Enhance
                </button>
              </div>

              {/* Hierarchical Preview Tree */}
              <div className="space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950/70 max-h-72 overflow-y-auto custom-scrollbar">
                
                {/* Course-level resources (Section 8) */}
                {scanResult.courseResources.length > 0 && (
                  <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Course Resources ({scanResult.courseResources.length})
                    </span>
                    {scanResult.courseResources.map((res) => (
                      <div key={res.id} className="flex items-center gap-2 text-xs text-slate-300 pl-2">
                        {res.resourceType === 'video' ? <Video size={12} className="text-blue-400" /> : <FileText size={12} className="text-emerald-400" />}
                        <span className="truncate">{res.cleanTitle}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Modules & Topics */}
                {scanResult.modules.map((mod) => (
                  <div key={mod.id} className="border border-slate-800/90 rounded-lg overflow-hidden bg-slate-900/40">
                    <button
                      type="button"
                      onClick={() => toggleModule(mod.id)}
                      className="w-full flex items-center justify-between p-2.5 hover:bg-slate-800/50 text-left transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedModules[mod.id] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                        <span className="text-xs font-bold text-white">{mod.name}</span>
                        <span className="text-[10px] text-slate-500">
                          ({mod.topics.length} topics • {mod.moduleResources.length} module files)
                        </span>
                      </div>
                    </button>

                    {expandedModules[mod.id] && (
                      <div className="p-2 pt-0 space-y-1.5 pl-6 border-t border-slate-800/40 bg-slate-950/30">
                        {/* Module-level resources */}
                        {mod.moduleResources.map((mr) => (
                          <div key={mr.id} className="flex items-center gap-2 text-xs text-slate-400 py-0.5">
                            {mr.resourceType === 'video' ? <Video size={11} className="text-blue-400" /> : <FileText size={11} className="text-emerald-400" />}
                            <span className="truncate">{mr.cleanTitle}</span>
                            <span className="text-[10px] text-slate-600">[Module File]</span>
                          </div>
                        ))}

                        {/* Topics */}
                        {mod.topics.map((top) => (
                          <div key={top.id} className="border-l-2 border-slate-800 pl-3 py-1 space-y-1">
                            <button
                              type="button"
                              onClick={() => toggleTopic(top.id)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white"
                            >
                              {expandedTopics[top.id] ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
                              <span>{top.name}</span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                ({top.resources.length} files)
                              </span>
                            </button>

                            {expandedTopics[top.id] && (
                              <div className="pl-4 space-y-1 pt-0.5">
                                {top.resources.map((res) => (
                                  <div key={res.id} className="flex items-center gap-2 text-[11px] text-slate-400">
                                    {res.resourceType === 'video' ? (
                                      <Video size={11} className="text-blue-400 shrink-0" />
                                    ) : res.resourceType === 'pdf' ? (
                                      <FileText size={11} className="text-emerald-400 shrink-0" />
                                    ) : res.resourceType === 'photo' ? (
                                      <ImageIcon size={11} className="text-purple-400 shrink-0" />
                                    ) : (
                                      <FileBox size={11} className="text-slate-400 shrink-0" />
                                    )}
                                    <span className="truncate">{res.cleanTitle}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setScanResult(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  ← Rescan Another Folder
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
                  >
                    <CheckCircle2 size={14} />
                    {existingCourseId ? 'Apply Drive Changes' : 'Import Course'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
