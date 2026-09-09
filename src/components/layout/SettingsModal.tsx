'use client';

import React, { useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { exportCourseToZip, importCourseFromZip } from '@/lib/exportImport';
import { syncToGoogleDrive, restoreFromGoogleDrive, signOutGoogle, checkLastBackupTime, saveUserLocally } from '@/lib/driveSync';
import { Download, Upload, Moon, Sun, AlertCircle, Cloud, BookOpen, Loader2, LogOut } from 'lucide-react';
import { CommunityLibraryModal } from './CommunityLibraryModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const courses = useCurriculumStore((state) => state.courses);
  const { theme, toggleTheme } = useThemeStore();
  
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [driveStatus, setDriveStatus] = useState<string>('');
  const [driveUser, setDriveUser] = useState<any>(null);

  React.useEffect(() => {
    if (isOpen) {
      checkLastBackupTime().then(res => {
        if (res && res.user) setDriveUser(res.user);
      }).catch(() => {});
    }
  }, [isOpen]);
  
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
      setError(err.message || "Failed to backup to Google Drive.");
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
          <h3 className="font-medium text-[var(--text-main)]">Export Course</h3>
          <p className="text-sm text-[var(--text-muted)]">Download a course to share it. Personal progress and scores will be removed so it's fresh for others.</p>
          
          {courses.length === 0 ? (
            <p className="text-sm italic text-slate-500">You don't have any courses to export yet.</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-medium"
              >
                <option value="">Select a course...</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={handleExport}
                disabled={!selectedCourseId || isExporting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-lg transition-transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none font-medium whitespace-nowrap"
              >
                <Download size={18} />
                <span className="font-medium">{isExporting ? 'Exporting...' : 'Export'}</span>
              </button>
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
