'use client';

import React, { useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useUserStore } from '@/stores/useUserStore';
import { useAIStore } from '@/stores/useAIStore';
import { SUPPORTED_MODELS, AIProvider } from '@/types/ai';
import { exportCourseToZip, importCourseFromZip } from '@/lib/exportImport';
import { syncToGoogleDrive, restoreFromGoogleDrive, signOutGoogle, checkLastBackupTime, saveUserLocally } from '@/lib/driveSync';
import { useVideoCacheStore } from '@/stores/useVideoCacheStore';
import { formatBytes } from '@/lib/drive/cacheManager';
import { 
  Download, Upload, Moon, Sun, AlertCircle, Cloud, BookOpen, Loader2, LogOut, 
  Network, Users, ShieldCheck, Send, Sparkles, Key, CheckCircle2, ExternalLink, 
  Cpu, Globe, Search, Lock, Trash2, Eye, EyeOff, Check, X, Video
} from 'lucide-react';
import { CommunityLibraryModal } from './CommunityLibraryModal';
import { sanitizeCourseCurriculum, sanitizeEntireDegree, publishToCommunityOneTap } from '@/lib/community';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const courses = useCurriculumStore((state) => state.courses);
  const { theme, toggleTheme } = useThemeStore();
  const { profile, setEcosystemMode, updateProfileSettings } = useUserStore();
  const {
    keys: aiKeys,
    activeProvider,
    activeModel,
    recognizedModels,
    autoDiscoverModels,
    setKey: setAIKey,
    removeKey: removeAIKey,
    setActiveProvider,
    setActiveModel,
    testConnection: testAIConnection,
    connectionStatuses,
    clearAllKeys
  } = useAIStore();
  
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [isCommunityPublishing, setIsCommunityPublishing] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; message: string; url?: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [driveStatus, setDriveStatus] = useState<string>('');
  const [driveUser, setDriveUser] = useState<any>(null);

  const videoSettings = useVideoCacheStore((state) => state.settings);
  const updateVideoSettings = useVideoCacheStore((state) => state.updateSettings);
  const clearAllVideoCache = useVideoCacheStore((state) => state.clearAllCache);
  const totalVideoStorage = useVideoCacheStore((state) => state.getTotalStorageBytes());

  const handleClearVideoCache = async () => {
    if (window.confirm('Delete all offline video files from device? (Original videos on Google Drive will remain 100% safe).')) {
      await clearAllVideoCache();
      setSuccess('All offline video files cleared from device.');
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  React.useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  React.useEffect(() => {
    if (isOpen) {
      checkLastBackupTime().then(res => {
        if (res && res.user) setDriveUser(res.user);
      }).catch(() => {});

      if (aiKeys.gemini && aiKeys.gemini.trim().length >= 20) {
        autoDiscoverModels('gemini').catch(() => {});
      }
    }
  }, [isOpen, aiKeys.gemini, autoDiscoverModels]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDriveBackup = async () => {
    try {
      setIsDriveSyncing(true);
      setError(null);
      await syncToGoogleDrive((status) => setDriveStatus(status));
      setSuccess("Backup completed successfully!");
      setTimeout(() => setSuccess(null), 3000);
      const res = await checkLastBackupTime();
      if (res && res.user) setDriveUser(res.user);
    } catch (err: any) {
      const rawMsg = err.message || "";
      setError(`Google Drive sign-in: ${rawMsg || 'Authentication failed'}. (If you just saved scopes in Google Cloud, please wait 3-5 min for Google to sync).`);
    } finally {
      setIsDriveSyncing(false);
      setDriveStatus('');
    }
  };

  const handleDriveRestore = async () => {
    try {
      setIsDriveSyncing(true);
      setError(null);
      await restoreFromGoogleDrive((status) => setDriveStatus(status));
      setSuccess("Restore completed successfully! Reloading...");
    } catch (err: any) {
      setError(err.message || "Failed to restore from Google Drive.");
      setIsDriveSyncing(false);
      setDriveStatus('');
    }
  };

  const handleDriveSignOut = async () => {
    try {
      await signOutGoogle();
      setDriveUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = async () => {
    if (!selectedCourseId) return;
    try {
      setIsExporting(true);
      setError(null);
      await exportCourseToZip(selectedCourseId);
      setSuccess("Course exported successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to export course");
    } finally {
      setIsExporting(false);
    }
  };

  const handleOneTapPublishCourse = async () => {
    const courseIdToPublish = selectedCourseId || (courses.length > 0 ? courses[0].id : '');
    if (!courseIdToPublish) return;
    try {
      setIsCommunityPublishing(true);
      setError(null);
      setExportFeedback(null);

      if (courseIdToPublish === 'all') {
        const sanitizedCourses = await sanitizeEntireDegree();
        const results: any[] = [];
        for (const item of sanitizedCourses) {
          const res = await publishToCommunityOneTap(item, item.course.title);
          results.push(res);
        }
        const ids = results.map(r => r.submissionId).filter(Boolean);
        const msg = `✓ Successfully submitted all ${results.length} degree courses to community review (${ids.join(', ')})!`;
        setSuccess(msg);
        setExportFeedback({ type: 'success', message: msg, url: results[0]?.url });
      } else {
        const course = courses.find(c => c.id === courseIdToPublish);
        const sanitized = await sanitizeCourseCurriculum(courseIdToPublish);
        const res = await publishToCommunityOneTap(sanitized, course?.name || 'Course Curriculum');
        setSuccess(res.message);
        setExportFeedback({ type: 'success', message: res.message, url: res.url });
      }
      setTimeout(() => setExportFeedback(null), 10000);
    } catch (err: any) {
      const msg = err.message || "Failed to publish course to community";
      setError(msg);
      setExportFeedback({ type: 'error', message: msg });
    } finally {
      setIsCommunityPublishing(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setError(null);
      await importCourseFromZip(file);
      await useCurriculumStore.getState().initialize(true);
      setSuccess("Course imported successfully! Check your dashboard.");
      setTimeout(() => setSuccess(null), 3000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || "Failed to import course. Invalid package.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Settings & Options">
      <div className="flex flex-col gap-6">
        
        {error && (
          <div className="flex items-center justify-between gap-2 p-3 text-sm text-red-500 bg-red-500/10 rounded-lg border border-red-500/20">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <p>{error}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setError(null)} 
              className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-600 transition-colors shrink-0"
              title="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}
        
        {success && (
          <div className="flex items-center gap-2 p-3 text-sm text-emerald-500 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <AlertCircle size={16} />
            <p>{success}</p>
          </div>
        )}

        {/* Import Section */}
        <div className="flex flex-col gap-3 pb-6 border-b border-border">
          <h3 className="font-medium text-[var(--text-main)]">Import Course</h3>
          <p className="text-sm text-[var(--text-muted)]">Add a course to your curriculum by uploading a .zip package or a raw .json file, or browsing the community library.</p>
          
          <input 
            type="file" 
            accept=".zip,.json" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImport}
          />
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              <Upload size={18} />
              {isImporting ? 'Importing...' : 'From Device (.zip/.json)'}
            </button>
            <button 
              onClick={() => setIsLibraryOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors font-medium border border-slate-200 dark:border-slate-700"
            >
              <BookOpen size={18} />
              Community Library
            </button>
          </div>
        </div>

        {/* Export Section */}
        <div className="flex flex-col gap-3 pb-6 border-b border-border">
          <h3 className="font-medium text-[var(--text-main)]">Export Course / Degree</h3>
          <p className="text-sm text-[var(--text-muted)]">Export your curriculum to the Community Library or download a package. Personal study progress and scores are automatically removed.</p>
          
          {courses.length === 0 ? (
            <p className="text-sm italic text-slate-500">You don't have any courses to export yet.</p>
          ) : (
            <div className="space-y-3 mt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Course or Degree Track:
                </label>
                <select
                  value={selectedCourseId || (courses.length > 0 ? courses[0].id : '')}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {courses.length > 1 && (
                    <option value="all">★ Entire Degree Track ({courses.length} Courses)</option>
                  )}
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleOneTapPublishCourse}
                  disabled={isCommunityPublishing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-lg transition-transform active:scale-95 disabled:opacity-50 font-medium text-sm shadow-sm"
                  title="1-Tap export sanitized course to community"
                >
                  {isCommunityPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>{isCommunityPublishing ? 'Publishing...' : '1-Tap to Community'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={!selectedCourseId || selectedCourseId === 'all' || isExporting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg transition-transform active:scale-95 disabled:opacity-50 font-medium text-sm"
                  title="Download .zip course package"
                >
                  <Download size={16} />
                  <span>{isExporting ? 'Exporting...' : 'Download .zip'}</span>
                </button>
              </div>

              {exportFeedback && (
                <div className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-all ${
                  exportFeedback.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {exportFeedback.type === 'success' ? <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                    <span>{exportFeedback.message}</span>
                  </div>
                  {exportFeedback.url && (
                    <a
                      href={exportFeedback.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline flex items-center gap-0.5 text-blue-600 dark:text-blue-400 shrink-0 font-semibold"
                    >
                      View Issue <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cloud Sync */}
        <div className="flex flex-col gap-3 pb-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-[var(--text-main)] flex items-center gap-2">
                <Cloud className="w-4 h-4" /> Cloud Sync
              </h3>
              <p className="text-sm text-[var(--text-muted)]">Backup your data to Google Drive.</p>
            </div>
            {driveUser && (
              <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/50">
                Connected
              </span>
            )}
          </div>
          
          {isDriveSyncing ? (
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
              <p className="text-sm font-medium text-[var(--text-main)]">{driveStatus || 'Syncing...'}</p>
            </div>
          ) : driveUser ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  {driveUser.imageUrl && <img src={driveUser.imageUrl} alt="Profile" className="w-8 h-8 rounded-full" />}
                  <div className="flex flex-col text-sm">
                    <span className="font-medium text-[var(--text-main)]">{driveUser.name}</span>
                    <span className="text-[var(--text-muted)] text-xs">{driveUser.email}</span>
                  </div>
                </div>
                <button onClick={handleDriveSignOut} className="text-slate-500 hover:text-red-500 transition-colors p-2" title="Sign Out">
                  <LogOut size={16} />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleDriveBackup}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
                >
                  <Upload size={18} /> Backup Now
                </button>
                <button
                  onClick={handleDriveRestore}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium"
                >
                  <Download size={18} /> Restore Backup
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleDriveBackup}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 w-full font-medium"
            >
              <Cloud size={18} /> Connect Google Drive
            </button>
          )}
        </div>

        {/* Smart Video Offline Cache Section */}
        <div className="flex flex-col gap-3 pb-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-red-500" />
              Smart Video Offline Cache
            </h3>
            <span className="text-[11px] font-medium text-slate-500">
              Storage: <strong className="text-slate-800 dark:text-slate-200">{formatBytes(totalVideoStorage)}</strong>
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Automatically pre-downloads upcoming lectures in the background while studying. Watched lectures are automatically removed from your device after a retention period to preserve storage (Google Drive files remain untouched).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Background Prefetch Window
              </label>
              <select
                value={videoSettings.prefetchCount}
                onChange={(e) => updateVideoSettings({ prefetchCount: Number(e.target.value) })}
                className="w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
              >
                <option value={1}>Download Next 1 Lecture</option>
                <option value={2}>Download Next 2 Lectures (Recommended)</option>
                <option value={3}>Download Next 3 Lectures</option>
                <option value={0}>Disabled (Stream Only)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Auto-Purge Watched Lectures
              </label>
              <select
                value={videoSettings.retentionDays}
                onChange={(e) => updateVideoSettings({ retentionDays: Number(e.target.value) })}
                className="w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
              >
                <option value={1}>Delete after 1 Day</option>
                <option value={3}>Delete after 3 Days (Recommended)</option>
                <option value={7}>Delete after 7 Days</option>
                <option value={0}>Never Auto-Delete</option>
              </select>
            </div>
          </div>

          {totalVideoStorage > 0 && (
            <button
              type="button"
              onClick={handleClearVideoCache}
              className="py-2 px-3 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg border border-red-200 dark:border-red-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 size={13} /> Clear All Offline Video Cache ({formatBytes(totalVideoStorage)})
            </button>
          )}
        </div>

        {/* AI & API Keys (BYOK) Section */}
        <div className="flex flex-col gap-4 pb-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              AI & API Keys (BYOK)
            </h3>
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <Lock size={11} /> 100% Local Storage
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Bring your own API keys for the <strong>AI Course Curation Engine</strong> and real-time educational discovery. Keys remain strictly in your browser and are excluded from backups and community exports.
          </p>

          {/* Active Model Selection */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Default Active AI Model
              </span>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                Used for Course Curation
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Provider</label>
                <select
                  value={activeProvider}
                  onChange={(e) => setActiveProvider(e.target.value as AIProvider)}
                  className="w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                >
                  <option value="gemini">Google Gemini (Recommended)</option>
                  <option value="groq">Groq (Ultra-Fast LPUs)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="anthropic">Anthropic (Claude 3.7 / 3.5)</option>
                  <option value="openrouter">OpenRouter (Unified Access)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-500">Model</label>
                  {activeProvider === 'gemini' && (recognizedModels?.gemini?.length ?? 0) > 0 && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Auto-recognized ({recognizedModels.gemini.length})
                    </span>
                  )}
                </div>
                <select
                  value={activeModel}
                  onChange={(e) => setActiveModel(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                >
                  {((recognizedModels?.[activeProvider]?.length)
                    ? recognizedModels[activeProvider]
                    : (SUPPORTED_MODELS[activeProvider] || [])
                  ).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.isRecommended ? '★ Recommended' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* AI Providers Keys */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              AI Provider Keys
            </span>

            {[
              { 
                id: 'gemini', 
                name: 'Google Gemini API Key', 
                badge: 'Recommended', 
                link: 'https://aistudio.google.com/app/apikey', 
                linkLabel: 'Get free key (AI Studio)',
                placeholder: 'AIzaSy...' 
              },
              { 
                id: 'groq', 
                name: 'Groq API Key', 
                badge: 'Fastest', 
                link: 'https://console.groq.com/keys', 
                linkLabel: 'console.groq.com',
                placeholder: 'gsk_...' 
              },
              { 
                id: 'openai', 
                name: 'OpenAI API Key', 
                link: 'https://platform.openai.com/api-keys', 
                linkLabel: 'platform.openai.com',
                placeholder: 'sk-proj-...' 
              },
              { 
                id: 'anthropic', 
                name: 'Anthropic API Key', 
                link: 'https://console.anthropic.com/settings/keys', 
                linkLabel: 'console.anthropic.com',
                placeholder: 'sk-ant-...' 
              },
              { 
                id: 'openrouter', 
                name: 'OpenRouter API Key', 
                link: 'https://openrouter.ai/keys', 
                linkLabel: 'openrouter.ai',
                placeholder: 'sk-or-...' 
              }
            ].map((p) => {
              const status = connectionStatuses[p.id];
              const isMasked = !showKeys[p.id];
              const currentVal = (aiKeys as any)[p.id] || '';

              return (
                <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {p.name}
                      </span>
                      {p.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                          {p.badge}
                        </span>
                      )}
                    </div>
                    {p.link && (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-500 hover:underline inline-flex items-center gap-0.5"
                      >
                        {p.linkLabel} <ExternalLink size={10} />
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={isMasked ? 'password' : 'text'}
                        value={currentVal}
                        onChange={(e) => setAIKey(p.id, e.target.value)}
                        placeholder={p.placeholder}
                        className="w-full text-xs py-1.5 pl-2.5 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeys((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        title={isMasked ? 'Show key' : 'Hide key'}
                      >
                        {isMasked ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={!currentVal.trim() || status?.status === 'testing'}
                      onClick={() => testAIConnection(p.id as any)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-colors shrink-0 flex items-center gap-1"
                    >
                      {status?.status === 'testing' ? (
                        <>
                          <Loader2 size={12} className="animate-spin" /> Testing
                        </>
                      ) : (
                        'Test'
                      )}
                    </button>
                  </div>

                  {/* Status indicator */}
                  {status && status.status !== 'idle' && (
                    <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
                      {status.status === 'connected' && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 flex-wrap">
                          <CheckCircle2 size={12} className="shrink-0" /> Connected ({status.latencyMs}ms)
                          {status.recognizedModel && (
                            <span className="text-emerald-700 dark:text-emerald-300 font-semibold ml-1">
                              • Auto-recognized: {status.recognizedModel}
                            </span>
                          )}
                        </span>
                      )}
                      {status.status === 'error' && (
                        <span className="text-red-500 font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> {status.errorMsg || 'Connection failed'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Search & Tool Discovery Keys */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Search & Discovery Keys (Optional)
            </span>

            {[
              {
                id: 'tavily',
                name: 'Tavily Search API Key',
                desc: 'Real-time web verification for latest documentation & tutorials',
                link: 'https://tavily.com',
                linkLabel: 'tavily.com',
                placeholder: 'tvly-...'
              },
              {
                id: 'youtube',
                name: 'YouTube Data API v3 Key',
                desc: 'Discovers verified educational videos and playlists',
                link: 'https://console.cloud.google.com/apis/credentials',
                linkLabel: 'Google Cloud Console',
                placeholder: 'AIzaSy...'
              },
              {
                id: 'github',
                name: 'GitHub Personal Access Token',
                desc: 'Discovers open-source repositories and hands-on coding exercises',
                link: 'https://github.com/settings/tokens',
                linkLabel: 'github.com/settings/tokens',
                placeholder: 'ghp_... or github_pat_...'
              }
            ].map((tool) => {
              const status = connectionStatuses[tool.id];
              const isMasked = !showKeys[tool.id];
              const currentVal = (aiKeys as any)[tool.id] || '';

              return (
                <div key={tool.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                        {tool.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {tool.desc}
                      </span>
                    </div>
                    {tool.link && (
                      <a
                        href={tool.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-500 hover:underline inline-flex items-center gap-0.5 shrink-0 ml-2"
                      >
                        {tool.linkLabel} <ExternalLink size={10} />
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={isMasked ? 'password' : 'text'}
                        value={currentVal}
                        onChange={(e) => setAIKey(tool.id, e.target.value)}
                        placeholder={tool.placeholder}
                        className="w-full text-xs py-1.5 pl-2.5 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeys((prev) => ({ ...prev, [tool.id]: !prev[tool.id] }))}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        title={isMasked ? 'Show key' : 'Hide key'}
                      >
                        {isMasked ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={!currentVal.trim() || status?.status === 'testing'}
                      onClick={() => testAIConnection(tool.id as any)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-colors shrink-0 flex items-center gap-1"
                    >
                      {status?.status === 'testing' ? (
                        <>
                          <Loader2 size={12} className="animate-spin" /> Testing
                        </>
                      ) : (
                        'Test'
                      )}
                    </button>
                  </div>

                  {/* Status indicator */}
                  {status && status.status !== 'idle' && (
                    <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
                      {status.status === 'connected' && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 size={12} /> Connected ({status.latencyMs}ms)
                        </span>
                      )}
                      {status.status === 'error' && (
                        <span className="text-red-500 font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> {status.errorMsg || 'Connection failed'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">
              Keys are stored in browser localStorage only.
            </span>
            {Object.keys(aiKeys).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to remove all saved AI and search keys from this device?')) {
                    clearAllKeys();
                  }
                }}
                className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
              >
                <Trash2 size={12} /> Clear All Keys
              </button>
            )}
          </div>
        </div>

        {/* Ecosystem Toggle */}
        <div className="flex flex-col gap-3 pb-6 border-b border-border">
          <h3 className="font-medium text-[var(--text-main)]">Integration</h3>
          <button
            onClick={() => {
              if (profile) {
                setEcosystemMode(!profile.ecosystemMode);
              }
            }}
            className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Network size={20} />
              <div className="flex flex-col">
                <span className="font-medium text-slate-900 dark:text-slate-100">Local Ecosystem Mode</span>
                <span className="text-xs text-slate-500">Broadcast study sessions to other apps</span>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${profile?.ecosystemMode ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${profile?.ecosystemMode ? 'left-5' : 'left-1'}`} />
            </div>
          </button>

          {profile?.ecosystemMode && (
            <div className="flex flex-col gap-2 pl-4 ml-2 border-l-2 border-slate-200 dark:border-slate-700 mt-2">
              <button
                onClick={() => {
                  if (profile) updateProfileSettings({ useExternalTimer: !profile.useExternalTimer });
                }}
                className="flex items-center justify-between w-full px-3 py-2 bg-transparent rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Delegate Study Sessions</span>
                  <span className="text-xs text-slate-500">Use external productivity app for sessions</span>
                </div>
                <div className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${profile.useExternalTimer ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300 ${profile.useExternalTimer ? 'left-3.5' : 'left-0.5'}`} />
                </div>
              </button>

              <button
                onClick={() => {
                  if (profile) updateProfileSettings({ useExternalFlashcards: !profile.useExternalFlashcards });
                }}
                className="flex items-center justify-between w-full px-3 py-2 bg-transparent rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Delegate Flashcards</span>
                  <span className="text-xs text-slate-500">Use external SRS app for spaced repetition</span>
                </div>
                <div className={`w-8 h-5 rounded-full relative transition-colors shrink-0 ${profile.useExternalFlashcards ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300 ${profile.useExternalFlashcards ? 'left-3.5' : 'left-0.5'}`} />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Community Publishing Section */}
        <div className="flex flex-col gap-3 pb-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[var(--text-main)] flex items-center gap-2">
              <Users size={18} /> Community & Ecosystem
            </h3>
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
              <ShieldCheck size={12} /> Privacy Firewall
            </span>
          </div>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Contribute high-confidence educational links and anonymous effectiveness ratings to help fellow self-directed learners.
          </p>

          <button
            onClick={() => {
              if (profile) {
                updateProfileSettings({ communityPublishingEnabled: !profile.communityPublishingEnabled });
              }
            }}
            className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
          >
            <div className="flex flex-col">
              <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                Enable Community Resource Sharing
              </span>
              <span className="text-xs text-slate-500">
                Allows sharing sanitized resource ratings from the Library
              </span>
            </div>
            <div className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${profile?.communityPublishingEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${profile?.communityPublishingEnabled ? 'left-5' : 'left-1'}`} />
            </div>
          </button>

          <div className="p-2.5 bg-slate-100/70 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-700/50 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
            <strong>🔒 Privacy Guarantee:</strong> Personal study progress, timestamps, quiz answers, and notes are strictly excluded. Only educational links and crowd confidence scores can be exported.
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="flex flex-col gap-3">
          <h3 className="font-medium text-[var(--text-main)]">Appearance</h3>
          <button
            onClick={toggleTheme}
            className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </div>
            <div className="w-10 h-6 bg-slate-300 dark:bg-slate-600 rounded-full relative transition-colors">
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${theme === 'dark' ? 'left-5' : 'left-1'}`} />
            </div>
          </button>
        </div>

      </div>
    </Modal>
    
    <CommunityLibraryModal 
      isOpen={isLibraryOpen} 
      onClose={() => setIsLibraryOpen(false)} 
    />
    </>
  );
}
