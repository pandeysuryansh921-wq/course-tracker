'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  FileText,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Pin,
  PinOff,
  AlertTriangle
} from 'lucide-react';
import { useVideoCacheStore } from '@/stores/useVideoCacheStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { resolveVideoSource, formatBytes, ResolvedVideoSource } from '@/lib/drive/cacheManager';
import { getCourseLibraryAccessToken } from '@/lib/driveSync';
import { playNativeLecture, isMedia3ExoPlayerAvailable } from '@/lib/player/lecturePlayerBridge';
import { playbackDiagnostics, PlaybackDiagnosticsState } from '@/lib/player/playbackDiagnostics';
import PlaybackDiagnosticOverlay from './PlaybackDiagnosticOverlay';
import { Capacitor } from '@capacitor/core';

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

const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

export default function VideoPlayerModal({
  isOpen,
  onClose,
  topicId: initialTopicId,
  courseId,
  lectureTitle: initialLectureTitle,
  fileId: initialFileId,
  slidesUrl,
  slidesTitle
}: VideoPlayerModalProps) {
  const [activeTopicId, setActiveTopicId] = useState(initialTopicId);
  const [activeLectureTitle, setActiveLectureTitle] = useState(initialLectureTitle);
  const [activeFileId, setActiveFileId] = useState(initialFileId);

  const [platformState, setPlatformState] = useState({
    isNative: false,
    platform: 'unknown'
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const [sourceData, setSourceData] = useState<ResolvedVideoSource | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [noteInput, setNoteInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'notes' | 'slides'>('notes');
  const [resumePrompt, setResumePrompt] = useState<{ show: boolean; time: number }>({ show: false, time: 0 });
  const [isLaunchingNative, setIsLaunchingNative] = useState<boolean>(true);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [showDiagOverlay, setShowDiagOverlay] = useState<boolean>(false);
  const [diagState, setDiagState] = useState<PlaybackDiagnosticsState>(playbackDiagnostics.getState());

  // Determine platform dynamically on client mount
  useEffect(() => {
    const isNat = Capacitor.isNativePlatform();
    const plat = Capacitor.getPlatform();
    setPlatformState({ isNative: isNat, platform: plat });
  }, []);

  const isAndroid = platformState.isNative && platformState.platform === 'android';

  // Subscribe to playback diagnostics
  useEffect(() => {
    return playbackDiagnostics.subscribe((state) => {
      setDiagState(state);
      if (state.hasError && state.errorMessage) {
        setNativeError(state.errorMessage);
        setShowDiagOverlay(true);
      }
    });
  }, []);

  // Sync state when props change
  useEffect(() => {
    setActiveTopicId(initialTopicId);
    setActiveLectureTitle(initialLectureTitle);
    setActiveFileId(initialFileId);
    setIsLaunchingNative(true);
    setNativeError(null);
  }, [initialTopicId, initialLectureTitle, initialFileId]);

  const cachedItem = useVideoCacheStore((state) => state.cachedVideos[activeTopicId]);
  const notes = useVideoCacheStore((state) => state.videoNotes[activeTopicId] || []);
  const downloadVideo = useVideoCacheStore((state) => state.downloadVideo);
  const deleteLocalCache = useVideoCacheStore((state) => state.deleteLocalCache);
  const togglePinOffline = useVideoCacheStore((state) => state.togglePinOffline);
  const recordProgress = useVideoCacheStore((state) => state.recordProgress);
  const addVideoNote = useVideoCacheStore((state) => state.addVideoNote);
  const deleteVideoNote = useVideoCacheStore((state) => state.deleteVideoNote);
  const startPrefetchQueue = useVideoCacheStore((state) => state.startPrefetchQueue);

  const topics = useCurriculumStore((state) => state.topics);
  const modules = useCurriculumStore((state) => state.modules);
  const courses = useCurriculumStore((state) => state.courses);
  const resources = useCurriculumStore((state) => state.resources);

  const effectiveCourseId = courseId || topics.find((t) => t.id === activeTopicId)?.courseId || '';
  const currentCourse = courses.find((c) => c.id === effectiveCourseId);

  // Sequential topics
  const courseModules = modules
    .filter((m) => m.courseId === effectiveCourseId)
    .sort((a, b) => a.order - b.order);

  const orderedCourseTopics = React.useMemo(() => {
    if (courseModules.length > 0) {
      const result: typeof topics = [];
      for (const m of courseModules) {
        const mTopics = topics.filter((t) => t.moduleId === m.id).sort((a, b) => a.order - b.order);
        result.push(...mTopics);
      }
      return result;
    }
    return topics.filter((t) => t.courseId === effectiveCourseId).sort((a, b) => a.order - b.order);
  }, [courseModules, topics, effectiveCourseId]);

  const currentIndex = orderedCourseTopics.findIndex((t) => t.id === activeTopicId);
  const nextTopic = currentIndex !== -1 && currentIndex + 1 < orderedCourseTopics.length ? orderedCourseTopics[currentIndex + 1] : null;
  const nextTopicCache = nextTopic ? useVideoCacheStore.getState().cachedVideos[nextTopic.id] : null;
  const nextTopicVideoRes = nextTopic ? resources.find((r) => r.topicId === nextTopic.id && (r.type === 'video' || r.type?.toLowerCase() === 'video' || Boolean(r.driveFileId))) : null;
  const nextFileId = nextTopicVideoRes?.driveFileId || nextTopicVideoRes?.url?.match(/[\/=]([a-zA-Z0-9_-]{20,})/)?.[1];

  const switchToTopic = useCallback((targetTopicId: string) => {
    const target = orderedCourseTopics.find((t) => t.id === targetTopicId);
    if (!target) return;
    const res = resources.find((r) => r.topicId === target.id && (r.type === 'video' || r.type?.toLowerCase() === 'video' || Boolean(r.driveFileId)));
    const fId = res?.driveFileId || res?.url?.match(/[\/=]([a-zA-Z0-9_-]{20,})/)?.[1] || '';

    setActiveTopicId(target.id);
    setActiveLectureTitle(target.name);
    setActiveFileId(fId);
    setSourceData(null);
    setCurrentTime(0);
    setDuration(0);
    setResumePrompt({ show: false, time: 0 });
    setIsLaunchingNative(true);
    setNativeError(null);
    setShowDiagOverlay(false);
  }, [orderedCourseTopics, resources]);

  // Main playback initialization
  const initializePlayback = useCallback(async (mountedRef: { current: boolean }) => {
    const isNativePlatform = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();

    // Stage 04: VideoPlayerModal mounted
    console.log('[PLAYER_TRACE_04] VideoPlayerModal mounted & initialized:', {
      fileId: activeFileId,
      topicId: activeTopicId,
      lectureTitle: activeLectureTitle,
      isNativePlatform,
      platform
    });

    playbackDiagnostics.setMeta({
      topicId: activeTopicId,
      lectureTitle: activeLectureTitle,
      courseTitle: currentCourse?.name || 'DegreeTrack',
      fileId: activeFileId,
      platform,
      isNative: isNativePlatform
    });

    playbackDiagnostics.recordStep(
      '04',
      'success',
      `File ID: ${activeFileId || 'None'}, Title: "${activeLectureTitle}"`
    );

    if (!activeFileId) {
      const err = 'No valid Drive file ID provided for playback';
      console.error('[PLAYER_TRACE_04] Error:', err);
      playbackDiagnostics.recordStep('04', 'failed', err);
      playbackDiagnostics.recordError(err);
      if (mountedRef.current) {
        setNativeError(err);
        setIsLaunchingNative(false);
        setShowDiagOverlay(true);
      }
      return;
    }

    // Stage 05: Check Media3 availability
    let isNativeAndroid = false;
    try {
      isNativeAndroid = await isMedia3ExoPlayerAvailable();
      console.log('[PLAYER_TRACE_05] isMedia3ExoPlayerAvailable returned:', isNativeAndroid);
    } catch (availErr: any) {
      console.warn('[PLAYER_TRACE_05] Exception checking availability:', availErr);
      playbackDiagnostics.recordStep('05', 'failed', availErr?.message || String(availErr));
    }

    // Stage 06: Acquire Course Library OAuth token
    let token: string | undefined;
    playbackDiagnostics.recordStep('06', 'running', 'Requesting OAuth access token...');
    try {
      console.log('[PLAYER_TRACE_06] Fetching Course Library OAuth token...');
      const authRes = await getCourseLibraryAccessToken();
      token = authRes?.token;
      if (token) {
        const sanitized = `${token.substring(0, 8)}... (len: ${token.length})`;
        console.log(`[PLAYER_TRACE_06] Token acquired: ${sanitized}`);
        playbackDiagnostics.recordStep('06', 'success', `Token valid (len: ${token.length})`);
      } else {
        console.warn('[PLAYER_TRACE_06] No token returned from getCourseLibraryAccessToken');
        playbackDiagnostics.recordStep('06', 'failed', 'No OAuth token found');
      }
    } catch (tokenErr: any) {
      const errMsg = tokenErr?.message || String(tokenErr);
      console.warn(`[PLAYER_TRACE_06] Token acquisition warning: ${errMsg}`);
      playbackDiagnostics.recordStep('06', 'failed', errMsg);
    }

    // Stage 07: Resolve video source
    playbackDiagnostics.recordStep('07', 'running', 'Resolving local cache & stream URLs...');
    console.log('[PLAYER_TRACE_07] Resolving video source for fileId:', activeFileId);
    let resolved: ResolvedVideoSource;
    try {
      resolved = await resolveVideoSource(activeFileId, cachedItem?.localUri, token);
      console.log('[PLAYER_TRACE_07] Resolved video source:', {
        isOffline: resolved.isOffline,
        hasRawNativeUri: Boolean(resolved.rawNativeUri),
        hasDirectStreamUrl: Boolean(resolved.directStreamUrl)
      });
      playbackDiagnostics.recordStep(
        '07',
        'success',
        resolved.isOffline
          ? 'Local cache confirmed'
          : resolved.directStreamUrl
          ? 'Cloud direct stream URL built'
          : 'Stream URL created without token'
      );
    } catch (resolveErr: any) {
      const errMsg = resolveErr?.message || String(resolveErr);
      console.error('[PLAYER_TRACE_07] Failed to resolve video source:', errMsg);
      playbackDiagnostics.recordStep('07', 'failed', errMsg);
      playbackDiagnostics.recordError('Could not resolve video source', errMsg);
      if (mountedRef.current) {
        setNativeError(errMsg);
        setIsLaunchingNative(false);
        setShowDiagOverlay(true);
      }
      return;
    }

    if (!mountedRef.current) return;
    setSourceData(resolved);

    // Start background sequential prefetch
    if (token) {
      startPrefetchQueue(effectiveCourseId, activeTopicId, token);
    }

    // Check if resume position exists
    const savedTime = cachedItem?.currentTime || 0;
    if (savedTime > 10 && (!cachedItem?.duration || savedTime < cachedItem.duration - 15)) {
      setResumePrompt({ show: true, time: savedTime });
    }

    // Stage 08: Launch Native Android Media3 ExoPlayer
    if (isNativeAndroid) {
      setIsLaunchingNative(true);
      setNativeError(null);

      const videoUrlToPlay = resolved.isOffline && resolved.rawNativeUri
        ? resolved.rawNativeUri
        : (resolved.directStreamUrl || `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(activeFileId)}?alt=media`);

      let nextTopicInfo: any = undefined;
      if (nextTopic && nextFileId) {
        try {
          const nextResolved = await resolveVideoSource(nextFileId, nextTopicCache?.localUri, token);
          nextTopicInfo = {
            topicId: nextTopic.id,
            title: nextTopic.name,
            fileId: nextFileId,
            videoUrl: nextResolved.isOffline && nextResolved.rawNativeUri
              ? nextResolved.rawNativeUri
              : (nextResolved.directStreamUrl || `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(nextFileId)}?alt=media`)
          };
        } catch (nextErr) {
          console.warn('[VideoPlayerModal] Next topic resolve warning:', nextErr);
        }
      }

      try {
        console.log('[PLAYER_TRACE_08] Calling playNativeLecture with options:', {
          fileId: activeFileId,
          title: activeLectureTitle,
          courseTitle: currentCourse?.name || 'DegreeTrack',
          topicId: activeTopicId,
          savedTime,
          isOffline: resolved.isOffline,
          hasAccessToken: Boolean(token)
        });

        const result = await playNativeLecture({
          fileId: activeFileId,
          videoUrl: videoUrlToPlay,
          accessToken: token,
          title: activeLectureTitle,
          courseTitle: currentCourse?.name || 'DegreeTrack',
          topicId: activeTopicId,
          currentTime: savedTime,
          duration: cachedItem?.duration || 0,
          isOffline: resolved.isOffline,
          nextTopic: nextTopicInfo
        });

        console.log('[VideoPlayerModal] Returned from playNativeLecture:', result);

        if (!mountedRef.current) return;

        if (result.hasError) {
          const errDetail = `${result.errorMessage || 'ExoPlayer playback error'} (${result.errorCodeName || result.errorCode})`;
          console.error('[VideoPlayerModal] Playback returned error:', result);
          setNativeError(errDetail);
          setIsLaunchingNative(false);
          setShowDiagOverlay(true);
          return;
        }

        // Record progress from native player
        if (result.currentTime && result.duration) {
          recordProgress(activeTopicId, result.currentTime, result.duration);
        }

        // Import notes recorded in native player
        if (result.notesAdded && Array.isArray(result.notesAdded)) {
          for (const n of result.notesAdded) {
            if (n.text && typeof n.timestampSeconds === 'number') {
              addVideoNote(activeTopicId, n.timestampSeconds, n.text);
            }
          }
        }

        // Next lecture transition
        if (result.nextRequested && result.nextTopicId) {
          console.log('[VideoPlayerModal] Next lecture transition requested for:', result.nextTopicId);
          switchToTopic(result.nextTopicId);
          return;
        }

        // Normal close
        console.log('[VideoPlayerModal] Native player finished normally, closing modal');
        onClose();
      } catch (err: any) {
        const errMsg = err?.message || 'Failed to start native lecture player';
        console.error('[PLAYER_TRACE_08] Native player launch exception:', err);
        playbackDiagnostics.recordStep('08', 'failed', errMsg);
        playbackDiagnostics.recordError('Native player launch error', errMsg);
        if (mountedRef.current) {
          setNativeError(errMsg);
          setIsLaunchingNative(false);
          setShowDiagOverlay(true);
        }
      }
    } else {
      // Non-native or web platform
      setIsLaunchingNative(false);
      if (isNativePlatform && platform === 'android') {
        const err = 'Media3 ExoPlayer plugin is not responding on this Android device.';
        console.error('[VideoPlayerModal]', err);
        setNativeError(err);
        setShowDiagOverlay(true);
      }
    }
  }, [activeFileId, activeTopicId, activeLectureTitle, cachedItem?.currentTime, cachedItem?.duration, cachedItem?.localUri, currentCourse?.name, effectiveCourseId, nextFileId, nextTopic, nextTopicCache?.localUri, onClose, recordProgress, addVideoNote, startPrefetchQueue, switchToTopic]);

  // Main lifecycle
  useEffect(() => {
    if (!isOpen) return;

    const mountedRef = { current: true };
    initializePlayback(mountedRef);

    return () => {
      mountedRef.current = false;
    };
  }, [isOpen, activeFileId, initializePlayback]);

  if (!isOpen) return null;

  const isDownloading = cachedItem?.status === 'downloading';
  const isOffline = sourceData?.isOffline || cachedItem?.status === 'cached';
  const isPinned = cachedItem?.isPinnedOffline;

  const formatSeconds = (sec: number) => {
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    const h = Math.floor(m / 60);
    if (h > 0) {
      const remM = m % 60;
      return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      setCurrentTime(cur);
      if (dur > 0) {
        setDuration(dur);
        recordProgress(activeTopicId, cur, dur);
      }
    }
  };

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(seconds, duration || seconds));
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    addVideoNote(activeTopicId, currentTime, noteInput);
    setNoteInput('');
  };

  const handleManualDownload = () => {
    downloadVideo(activeTopicId, activeFileId, activeLectureTitle, courseId);
  };

  const handleManualDelete = () => {
    deleteLocalCache(activeTopicId);
    resolveVideoSource(activeFileId).then(setSourceData);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4">
        <div className="relative w-full max-w-6xl max-h-[96vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
          
          {/* Top Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/95 shrink-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">
                    {currentCourse?.name || 'Course'}
                  </span>
                  <span className="text-slate-600">•</span>
                  {isOffline ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <HardDrive size={11} /> Offline Ready (On Device)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      <Cloud size={11} /> Google Drive Stream
                    </span>
                  )}
                  {cachedItem?.isWatched && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      <CheckCircle2 size={11} /> Watched ({cachedItem.watchedPercentage}%)
                    </span>
                  )}
                </div>
                <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-xl mt-0.5">
                  {activeLectureTitle}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Diagnostics Button */}
              <button
                onClick={() => setShowDiagOverlay(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                title="View Playback Diagnostics Trace"
              >
                <AlertTriangle size={13} className="text-amber-400" />
                <span className="hidden sm:inline">Trace</span>
              </button>

              {/* Pin Offline Toggle */}
              {isOffline && (
                <button
                  onClick={() => togglePinOffline(activeTopicId)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isPinned
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                  title={isPinned ? "Pinned: Protected from auto-purge" : "Pin offline (protect from auto-delete)"}
                >
                  {isPinned ? <Pin size={12} className="fill-amber-300" /> : <PinOff size={12} />}
                  <span className="hidden sm:inline">{isPinned ? 'Pinned' : 'Pin'}</span>
                </button>
              )}

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
                  title="Free device space (Google Drive file remains safe)"
                >
                  <Trash2 size={13} />
                  <span className="hidden sm:inline">Free Space ({formatBytes(cachedItem?.fileSize)})</span>
                </button>
              ) : (
                <button
                  onClick={handleManualDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
                  title="Download for offline access"
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
            <div className="flex-1 flex flex-col justify-between bg-black relative min-h-[340px] sm:min-h-[460px]">
              {isAndroid || platformState.isNative ? (
                // Native Android Experience: NEVER render an iframe!
                isLaunchingNative ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
                    <Loader2 size={40} className="animate-spin text-blue-500" />
                    <div className="space-y-1">
                      <p className="text-base font-bold text-white">Launching Native Media3 ExoPlayer...</p>
                      <p className="text-xs text-slate-400">Hardware accelerated 60fps streaming • {activeLectureTitle}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Cloud size={12} /> Google Drive Media3 Stream
                    </span>
                    <button
                      onClick={() => setShowDiagOverlay(true)}
                      className="mt-2 text-xs text-slate-400 hover:text-white underline"
                    >
                      View Live Trace
                    </button>
                  </div>
                ) : nativeError ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
                    <div className="p-3 bg-red-500/20 text-red-400 rounded-full">
                      <X size={32} />
                    </div>
                    <div className="space-y-1 max-w-md">
                      <p className="text-sm font-bold text-white">Could Not Launch Native Player</p>
                      <p className="text-xs text-red-300 font-mono break-all">{nativeError}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDiagOverlay(true)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 shadow-sm transition-colors"
                      >
                        View Diagnostic Trace
                      </button>
                      <button
                        onClick={() => {
                          setNativeError(null);
                          setIsLaunchingNative(true);
                          const mountedRef = { current: true };
                          initializePlayback(mountedRef);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                      >
                        Retry Native Player
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 text-center">
                    <p className="text-sm text-slate-400">Playback finished or closed.</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDiagOverlay(true)}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Diagnostic Log
                      </button>
                      <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )
              ) : isLaunchingNative ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
                  <Loader2 size={36} className="animate-spin text-blue-500" />
                  <p className="text-sm font-medium text-slate-300">Loading Lecture...</p>
                </div>
              ) : sourceData?.src ? (
                <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden group">
                  <video
                    ref={videoRef}
                    src={sourceData.src}
                    playsInline
                    autoPlay
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => recordProgress(activeTopicId, duration, duration)}
                    className="w-full h-full max-h-[70vh] object-contain"
                  />

                  {/* Resume Prompt Toast Overlay */}
                  {resumePrompt.show && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2 bg-slate-900/90 border border-slate-700 rounded-full shadow-lg text-xs text-white">
                      <span>Resumed from <strong>{formatSeconds(resumePrompt.time)}</strong></span>
                      <button
                        onClick={() => {
                          handleSeek(0);
                          setResumePrompt({ show: false, time: 0 });
                        }}
                        className="text-blue-400 hover:underline font-bold text-[11px]"
                      >
                        Start Over
                      </button>
                      <button
                        onClick={() => setResumePrompt({ show: false, time: 0 })}
                        className="text-slate-400 hover:text-white ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Non-native fallback message (NO IFRAME ON ANDROID) */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <AlertTriangle size={36} className="text-amber-400" />
                  <p className="text-sm text-slate-300">Streaming is configured for native hardware player.</p>
                  <button
                    onClick={() => setShowDiagOverlay(true)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700"
                  >
                    View Diagnostics
                  </button>
                </div>
              )}

              {/* Custom Responsive Controls Bar (for HTML5 Video playback on web) */}
              {sourceData?.src && (
                <div className="p-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent shrink-0 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-300 min-w-[42px]">
                      {formatSeconds(currentTime)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-xs font-mono text-slate-400 min-w-[42px]">
                      {formatSeconds(duration)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        onClick={handlePlayPause}
                        className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        onClick={() => handleSeek(currentTime - 10)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-xs"
                        title="Rewind 10s"
                      >
                        <RotateCcw size={14} /> -10s
                      </button>
                      <button
                        onClick={() => handleSeek(currentTime + 10)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-xs"
                        title="Forward 10s"
                      >
                        <RotateCw size={14} /> +10s
                      </button>
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto py-1">
                      <span className="text-[11px] text-slate-400 font-medium mr-1">Speed:</span>
                      {PLAYBACK_SPEEDS.map((spd) => (
                        <button
                          key={spd}
                          onClick={() => handleSpeedChange(spd)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${
                            playbackSpeed === spd
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Interactive Notes & Resources Sidebar */}
            <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shrink-0">
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
                      <Clock size={10} /> Timestamp automatically captures current position.
                    </span>
                  </form>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {notes.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-500">
                        No notes taken yet. Bookmark key insights with automatic timestamps!
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
                              onClick={() => handleSeek(note.timestampSeconds)}
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
                            onClick={() => deleteVideoNote(activeTopicId, note.id)}
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
                    {/* Never render an iframe for Google Drive on native Android */}
                    <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700 text-center space-y-2">
                      <FileText size={28} className="mx-auto text-blue-400" />
                      <p className="text-xs text-slate-300">Tap below to view attached slides document.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (platformState.isNative && isAndroid) {
                        import('@capawesome/capacitor-android-intent-launcher')
                          .then(({ AndroidIntentLauncher }) => {
                            AndroidIntentLauncher.startActivity({
                              action: 'android.intent.action.VIEW',
                              dataUri: slidesUrl
                            }).catch(() => {});
                          })
                          .catch(() => {});
                      } else {
                        window.open(slidesUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="mt-3 flex items-center justify-center gap-1.5 py-2 px-3 text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors w-full"
                  >
                    <ExternalLink size={12} /> Open PDF Slides
                  </button>
                </div>
              )}

              {/* Up Next Lecture Footer in Sidebar */}
              {nextTopic && (
                <div className="p-3 border-t border-slate-800 bg-slate-900/80 shrink-0">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span>Up Next in Series</span>
                    {nextTopicCache?.status === 'cached' ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <HardDrive size={10} /> Ready Offline
                      </span>
                    ) : nextTopicCache?.status === 'downloading' ? (
                      <span className="text-blue-400 flex items-center gap-1 font-medium">
                        <Loader2 size={10} className="animate-spin" /> Prefetching ({nextTopicCache.downloadProgress || 0}%)
                      </span>
                    ) : (
                      <span className="text-slate-500">Google Drive Stream</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => switchToTopic(nextTopic.id)}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-800 hover:bg-slate-700/80 rounded-lg border border-slate-700 transition-colors text-left"
                  >
                    <span className="text-xs font-medium text-slate-200 truncate pr-2">
                      {nextTopic.name}
                    </span>
                    <ChevronRight size={14} className="text-slate-400 shrink-0" />
                  </button>
                </div>
              )}

            </div>

          </div>

        </div>
      </div>

      {/* Temporary Diagnostic Overlay when launch fails or on demand */}
      {showDiagOverlay && (
        <PlaybackDiagnosticOverlay
          state={diagState}
          onRetry={() => {
            setShowDiagOverlay(false);
            setNativeError(null);
            setIsLaunchingNative(true);
            const mountedRef = { current: true };
            initializePlayback(mountedRef);
          }}
          onClose={() => {
            setShowDiagOverlay(false);
          }}
        />
      )}
    </>
  );
}
