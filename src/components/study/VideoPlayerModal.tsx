'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Cloud, 
  HardDrive, 
  Clock, 
  Plus, 
  ChevronRight, 
  ExternalLink,
  Loader2,
  FileText
} from 'lucide-react';
import { useVideoCacheStore } from '@/stores/useVideoCacheStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { resolveVideoSource, formatBytes } from '@/lib/drive/cacheManager';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string;
  courseId: string;
  lectureTitle: string;
  fileId: string;
  slidesUrl?: string;
  slidesTitle?: string;
}

export default function VideoPlayerModal({
  isOpen,
  onClose,
  topicId,
  courseId,
  lectureTitle,
  fileId,
  slidesUrl,
  slidesTitle
}: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sourceData, setSourceData] = useState<{ src?: string; isOffline: boolean; iframeUrl: string } | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [noteInput, setNoteInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'notes' | 'slides'>('notes');

  const cachedItem = useVideoCacheStore((state) => state.cachedVideos[topicId]);
  const notes = useVideoCacheStore((state) => state.videoNotes[topicId] || []);
  const downloadVideo = useVideoCacheStore((state) => state.downloadVideo);
  const deleteLocalCache = useVideoCacheStore((state) => state.deleteLocalCache);
  const recordProgress = useVideoCacheStore((state) => state.recordProgress);
  const addVideoNote = useVideoCacheStore((state) => state.addVideoNote);
  const deleteVideoNote = useVideoCacheStore((state) => state.deleteVideoNote);
  const startPrefetchQueue = useVideoCacheStore((state) => state.startPrefetchQueue);

  const topics = useCurriculumStore((state) => state.topics);
  const courses = useCurriculumStore((state) => state.courses);
  const currentCourse = courses.find((c) => c.id === courseId);

  // Find next sequential topic in course
  const courseTopics = topics
    .filter((t) => t.courseId === courseId)
    .sort((a, b) => a.order - b.order);
  const currentIndex = courseTopics.findIndex((t) => t.id === topicId);
  const nextTopic = currentIndex !== -1 && currentIndex + 1 < courseTopics.length ? courseTopics[currentIndex + 1] : null;
  const nextTopicCache = nextTopic ? useVideoCacheStore.getState().cachedVideos[nextTopic.id] : null;

  // Resolve playable source whenever modal opens or file changes
  useEffect(() => {
    if (!isOpen || !fileId) return;

    let mounted = true;
    resolveVideoSource(fileId, cachedItem?.localUri).then((res) => {
      if (mounted) setSourceData(res);
    });

    // Start background rolling prefetch for upcoming lectures
    startPrefetchQueue(courseId, topicId);

    return () => {
      mounted = false;
    };
  }, [isOpen, fileId, cachedItem?.localUri, courseId, topicId, startPrefetchQueue]);

  if (!isOpen) return null;

  const isDownloading = cachedItem?.status === 'downloading';
  const isOffline = sourceData?.isOffline || cachedItem?.status === 'cached';

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      setCurrentTime(cur);
      if (dur > 0) {
        setDuration(dur);
        recordProgress(topicId, cur, dur);
      }
    }
  };

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    addVideoNote(topicId, currentTime, noteInput);
    setNoteInput('');
  };

  const handleManualDownload = () => {
    downloadVideo(topicId, fileId, lectureTitle, courseId);
  };

  const handleManualDelete = () => {
    deleteLocalCache(topicId);
    // Refresh source to stream mode
    resolveVideoSource(fileId).then(setSourceData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4">
      <div className="relative w-full max-w-6xl max-h-[95vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">
                  {currentCourse?.name || 'Course'}
                </span>
                <span className="text-slate-600">•</span>
                {isOffline ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <HardDrive size={11} /> Offline Ready (On Device)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    <Cloud size={11} /> Streaming from Google Drive
                  </span>
                )}
                {cachedItem?.isWatched && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <CheckCircle2 size={11} /> Watched ({cachedItem.watchedPercentage}%)
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-lg">
                {lectureTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download / Delete Cache Control */}
            {isDownloading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-blue-400 border border-slate-700">
                <Loader2 size={14} className="animate-spin" />
                <span>Downloading ({cachedItem?.downloadProgress || 0}%)</span>
              </div>
            ) : isOffline ? (
              <button
                onClick={handleManualDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 border border-slate-700 transition-colors"
                title="Delete local file to free space (Drive file remains untouched)"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Free Space ({formatBytes(cachedItem?.fileSize)})</span>
              </button>
            ) : (
              <button
                onClick={handleManualDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
                title="Download for full offline access"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Save Offline</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Player"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Player & Sidebar Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Main Video Viewport */}
          <div className="flex-1 flex flex-col justify-center items-center bg-black relative min-h-[300px] sm:min-h-[420px]">
            {isOffline && sourceData?.src ? (
              <video
                ref={videoRef}
                src={sourceData.src}
                controls
                autoPlay
                playsInline
                onTimeUpdate={handleTimeUpdate}
                className="w-full h-full max-h-[70vh] object-contain"
              />
            ) : (
              /* Cloud Direct Stream Iframe */
              <iframe
                src={sourceData?.iframeUrl || `https://drive.google.com/file/d/${fileId}/preview`}
                className="w-full h-full min-h-[320px] sm:min-h-[460px] border-0"
                allow="autoplay; fullscreen"
                allowFullScreen
                title={lectureTitle}
              />
            )}
          </div>

          {/* Interactive Notes & Resources Sidebar */}
          <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-slate-800 text-xs font-medium">
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors ${
                  activeTab === 'notes'
                    ? 'border-blue-500 text-blue-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Timestamp Notes ({notes.length})
              </button>
              {slidesUrl && (
                <button
                  onClick={() => setActiveTab('slides')}
                  className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors ${
                    activeTab === 'slides'
                      ? 'border-blue-500 text-blue-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Slides / PDF
                </button>
              )}
            </div>

            {/* Notes Tab Content */}
            {activeTab === 'notes' && (
              <div className="flex-1 flex flex-col p-3 overflow-hidden">
                {/* Notes Input */}
                <form onSubmit={handleAddNote} className="mb-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder={`Add note at ${formatSeconds(currentTime)}...`}
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!noteInput.trim()}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
                      title="Add timestamped note"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock size={10} /> Timestamp automatically captures current video position.
                  </span>
                </form>

                {/* Notes List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      No notes taken yet. Type above to bookmark key insights with timestamps!
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="p-2.5 bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors group flex items-start justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => seekTo(note.timestampSeconds)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors"
                            title="Jump to timestamp"
                          >
                            <Clock size={10} />
                            {formatSeconds(note.timestampSeconds)}
                          </button>
                          <p className="text-xs text-slate-200 leading-relaxed">{note.text}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteVideoNote(topicId, note.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-opacity"
                          title="Delete note"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Slides Tab Content */}
            {activeTab === 'slides' && slidesUrl && (
              <div className="flex-1 p-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 text-red-400 rounded-lg">
                      <FileText size={18} />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-semibold text-white truncate">
                        {slidesTitle || 'Lecture Slides'}
                      </h4>
                      <p className="text-[11px] text-slate-400">Attached Google Drive PDF</p>
                    </div>
                  </div>
                  <iframe
                    src={slidesUrl.replace(/\/view.*$/, '/preview')}
                    className="w-full h-64 rounded-xl border border-slate-700"
                    title="Lecture Slides"
                  />
                </div>
                <a
                  href={slidesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center justify-center gap-1.5 py-2 px-3 text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors"
                >
                  <ExternalLink size={12} /> Open PDF in New Window
                </a>
              </div>
            )}

            {/* Next Lecture Footer in Sidebar */}
            {nextTopic && (
              <div className="p-3 border-t border-slate-800 bg-slate-900/60 shrink-0">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>Up Next in Series</span>
                  {nextTopicCache?.status === 'cached' ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <HardDrive size={10} /> Ready Offline
                    </span>
                  ) : nextTopicCache?.status === 'downloading' ? (
                    <span className="text-blue-400 flex items-center gap-1 font-medium">
                      <Loader2 size={10} className="animate-spin" /> Prefetching...
                    </span>
                  ) : (
                    <span className="text-slate-500">Google Drive Stream</span>
                  )}
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800 rounded-lg border border-slate-700">
                  <span className="text-xs font-medium text-slate-200 truncate pr-2">
                    {nextTopic.name}
                  </span>
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
