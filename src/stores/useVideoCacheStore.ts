import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { VideoCacheItem, VideoNote, VideoCacheSettings, CacheStatus } from '@/types/video';
import { downloadVideoToDevice, deleteCachedVideoFile, isVideoCachedLocally, formatBytes, cleanupOrphanedPartFiles } from '@/lib/drive/cacheManager';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { getCanonicalOrderedTopics } from '@/lib/curriculum/ordering';

interface VideoCacheState {
  cachedVideos: Record<string, VideoCacheItem>;
  videoNotes: Record<string, VideoNote[]>;
  settings: VideoCacheSettings;
  activeTopicId: string | null;

  // Actions
  updateSettings: (partial: Partial<VideoCacheSettings>) => void;
  setActiveTopicId: (topicId: string | null) => void;
  downloadVideo: (
    topicId: string,
    fileId: string,
    title: string,
    courseId: string,
    accessToken?: string
  ) => Promise<boolean>;
  deleteLocalCache: (topicId: string) => Promise<boolean>;
  clearAllCache: () => Promise<void>;
  togglePinOffline: (topicId: string) => void;
  startPrefetchQueue: (courseId: string, currentTopicId: string, accessToken?: string) => Promise<void>;
  recordProgress: (topicId: string, currentTime: number, duration: number) => void;
  addVideoNote: (topicId: string, timestampSeconds: number, text: string) => void;
  deleteVideoNote: (topicId: string, noteId: string) => void;
  enforceCacheCap: (incomingBytes?: number) => Promise<void>;
  runAutoPurgeSweep: () => Promise<number>;
  getTotalStorageBytes: () => number;
}

const DEFAULT_SETTINGS: VideoCacheSettings = {
  prefetchCount: 2,
  retentionDays: 3,
  maxCacheBytes: 5 * 1024 * 1024 * 1024, // 5 GB default cap
  wifiOnly: false,
  allowMobileData: true,
  requireChargingOnly: false,
  autoPurgeEnabled: true
};

export const useVideoCacheStore = create<VideoCacheState>()(
  persist(
    (set, get) => ({
      cachedVideos: {},
      videoNotes: {},
      settings: DEFAULT_SETTINGS,
      activeTopicId: null,

      updateSettings: (partial) => {
        set((state) => ({
          settings: { ...state.settings, ...partial }
        }));
      },

      setActiveTopicId: (topicId) => {
        set({ activeTopicId: topicId });
      },

      togglePinOffline: (topicId) => {
        set((state) => {
          const item = state.cachedVideos[topicId];
          if (!item) return state;
          const nextPinned = !item.isPinnedOffline;
          let nextStatus = item.status;
          if (
            item.status === 'CACHED_COMPLETE' ||
            item.status === 'PINNED_COMPLETE' ||
            item.status === 'cached'
          ) {
            nextStatus = nextPinned ? 'PINNED_COMPLETE' : 'CACHED_COMPLETE';
          }
          return {
            cachedVideos: {
              ...state.cachedVideos,
              [topicId]: {
                ...item,
                isPinnedOffline: nextPinned,
                status: nextStatus
              }
            }
          };
        });
      },

      enforceCacheCap: async (incomingBytes: number = 0) => {
        const { cachedVideos, settings } = get();
        if (settings.maxCacheBytes <= 0) return;

        let totalBytes = get().getTotalStorageBytes();
        if (totalBytes + incomingBytes <= settings.maxCacheBytes) return;

        // Find watched, non-pinned cached items sorted by watchedAt ascending (oldest watched first)
        const evictable = Object.values(cachedVideos)
          .filter(
            (item) =>
              (item.status === 'CACHED_COMPLETE' || item.status === 'cached') &&
              item.isWatched &&
              !item.isPinnedOffline
          )
          .sort((a, b) => {
            const timeA = a.watchedAt ? new Date(a.watchedAt).getTime() : 0;
            const timeB = b.watchedAt ? new Date(b.watchedAt).getTime() : 0;
            return timeA - timeB;
          });

        for (const item of evictable) {
          if (totalBytes + incomingBytes <= settings.maxCacheBytes) break;
          console.log(`[Cache Manager] Evicting watched lecture "${item.title}" to enforce storage cap (${formatBytes(settings.maxCacheBytes)}). Drive file safe.`);
          await deleteCachedVideoFile(item.fileId);
          set((state) => ({
            cachedVideos: {
              ...state.cachedVideos,
              [item.topicId]: {
                ...item,
                status: 'NOT_CACHED',
                localUri: undefined,
                downloadProgress: 0,
                downloadedBytes: 0,
                expiresAt: undefined
              }
            }
          }));
          totalBytes -= (item.fileSize || 0);
        }
      },

      downloadVideo: async (topicId, fileId, title, courseId, accessToken) => {
        const existing = get().cachedVideos[topicId];
        if (existing?.status === 'DOWNLOADING' || existing?.status === 'downloading') return false;

        // Check storage cap before starting
        await get().enforceCacheCap();

        // Set state to DOWNLOADING
        set((state) => ({
          cachedVideos: {
            ...state.cachedVideos,
            [topicId]: {
              topicId,
              fileId,
              title,
              courseId,
              status: 'DOWNLOADING',
              downloadProgress: 0,
              downloadedBytes: 0,
              watchedPercentage: existing?.watchedPercentage || 0,
              isWatched: existing?.isWatched || false,
              watchedAt: existing?.watchedAt,
              expiresAt: existing?.expiresAt,
              currentTime: existing?.currentTime || 0,
              duration: existing?.duration || 0,
              isPinnedOffline: existing?.isPinnedOffline || false
            }
          }
        }));

        try {
          const { localUri, fileSize } = await downloadVideoToDevice(
            fileId,
            topicId,
            accessToken,
            (pct) => {
              set((state) => {
                const item = state.cachedVideos[topicId];
                if (!item) return state;
                return {
                  cachedVideos: {
                    ...state.cachedVideos,
                    [topicId]: {
                      ...item,
                      downloadProgress: pct,
                      downloadedBytes: item.fileSize ? Math.round((pct / 100) * item.fileSize) : undefined
                    }
                  }
                };
              });
            }
          );

          // Enforce cap after download
          await get().enforceCacheCap(fileSize);

          const isPinned = get().cachedVideos[topicId]?.isPinnedOffline || false;
          set((state) => ({
            cachedVideos: {
              ...state.cachedVideos,
              [topicId]: {
                ...state.cachedVideos[topicId],
                status: isPinned ? 'PINNED_COMPLETE' : 'CACHED_COMPLETE',
                localUri,
                fileSize,
                downloadProgress: 100,
                downloadedBytes: fileSize,
                expectedBytes: fileSize,
                completedAt: new Date().toISOString(),
                errorMsg: undefined
              }
            }
          }));

          return true;
        } catch (err: any) {
          console.error(`[Video Cache] Download failed for topic ${topicId}:`, err);
          set((state) => ({
            cachedVideos: {
              ...state.cachedVideos,
              [topicId]: {
                ...state.cachedVideos[topicId],
                status: 'DOWNLOAD_FAILED',
                downloadProgress: 0,
                downloadedBytes: 0,
                errorMsg: err.message || 'Download failed'
              }
            }
          }));
          return false;
        }
      },

      deleteLocalCache: async (topicId) => {
        const item = get().cachedVideos[topicId];
        if (!item) return false;

        await deleteCachedVideoFile(item.fileId);

        set((state) => ({
          cachedVideos: {
            ...state.cachedVideos,
            [topicId]: {
              ...item,
              status: 'NOT_CACHED',
              localUri: undefined,
              downloadProgress: 0,
              downloadedBytes: 0,
              expiresAt: undefined
            }
          }
        }));

        return true;
      },

      clearAllCache: async () => {
        const allItems = Object.values(get().cachedVideos);
        for (const item of allItems) {
          if (
            item.status === 'CACHED_COMPLETE' ||
            item.status === 'PINNED_COMPLETE' ||
            item.status === 'cached' ||
            item.localUri
          ) {
            await deleteCachedVideoFile(item.fileId);
          }
        }

        set((state) => {
          const updated = { ...state.cachedVideos };
          Object.keys(updated).forEach((k) => {
            updated[k] = {
              ...updated[k],
              status: 'NOT_CACHED',
              localUri: undefined,
              downloadProgress: 0,
              downloadedBytes: 0,
              expiresAt: undefined
            };
          });
          return { cachedVideos: updated };
        });
      },

      startPrefetchQueue: async (courseId, currentTopicId, accessToken) => {
        const settings = get().settings;
        if (settings.prefetchCount <= 0) return;

        // Traverse topics in canonical curriculum order (single source of truth)
        const curriculumStore = useCurriculumStore.getState();
        const orderedTopics = getCanonicalOrderedTopics(
          courseId,
          curriculumStore.topics,
          curriculumStore.modules
        );

        const currentIndex = orderedTopics.findIndex((t) => t.id === currentTopicId);
        if (currentIndex === -1) return;

        // Take next N topics across module boundaries
        const upcoming = orderedTopics.slice(currentIndex + 1, currentIndex + 1 + settings.prefetchCount);

        for (const nextTopic of upcoming) {
          const topicResources = curriculumStore.resources.filter((r) => r.topicId === nextTopic.id);
          const videoRes = topicResources.find((r) => r.type === 'video');

          if (videoRes) {
            const fileId = videoRes.driveFileId || videoRes.url?.match(/[\/=]([a-zA-Z0-9_-]{25,})/)?.[1];

            if (fileId) {
              const currentCache = get().cachedVideos[nextTopic.id];
              const isComplete =
                currentCache?.status === 'CACHED_COMPLETE' ||
                currentCache?.status === 'PINNED_COMPLETE' ||
                currentCache?.status === 'cached';
              const isDownloading =
                currentCache?.status === 'DOWNLOADING' ||
                currentCache?.status === 'downloading';

              const isPhysicallyCached =
                isComplete && (await isVideoCachedLocally(fileId, undefined, currentCache));

              if (!isPhysicallyCached && !isDownloading) {
                console.log(`[Rolling Cache] Prefetching next sequential lecture in background: "${nextTopic.name}"`);
                get().downloadVideo(nextTopic.id, fileId, nextTopic.name, courseId, accessToken).catch(() => {});
              }
            }
          }
        }
      },

      recordProgress: (topicId, currentTime, duration) => {
        if (!duration || duration <= 0) return;
        const pct = Math.min(100, Math.round((currentTime / duration) * 100));

        set((state) => {
          const item = state.cachedVideos[topicId];
          const settings = state.settings;
          const wasWatched = item?.isWatched || false;
          // Completed at >= 90%
          const isNowWatched = wasWatched || pct >= 90;

          let expiresAt = item?.expiresAt;
          let watchedAt = item?.watchedAt;

          // When transitioning to watched (>= 90%):
          if (!wasWatched && isNowWatched) {
            watchedAt = new Date().toISOString();
            if (settings.autoPurgeEnabled && settings.retentionDays > 0) {
              const expireDate = new Date(Date.now() + settings.retentionDays * 86400000);
              expiresAt = expireDate.toISOString();
            }
            // Auto mark topic completed in curriculum store
            try {
              useCurriculumStore.getState().toggleTopicCompletion(topicId, true);
            } catch {}
          }

          return {
            cachedVideos: {
              ...state.cachedVideos,
              [topicId]: {
                ...(item || {
                  topicId,
                  fileId: '',
                  title: '',
                  courseId: '',
                  status: 'idle'
                }),
                currentTime: Math.floor(currentTime),
                duration: Math.floor(duration),
                lastPlayedAt: new Date().toISOString(),
                watchedPercentage: Math.max(item?.watchedPercentage || 0, pct),
                isWatched: isNowWatched,
                watchedAt,
                expiresAt
              }
            }
          };
        });
      },

      addVideoNote: (topicId, timestampSeconds, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const newNote: VideoNote = {
          id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          topicId,
          timestampSeconds: Math.floor(timestampSeconds),
          text: trimmed,
          createdAt: new Date().toISOString()
        };

        set((state) => ({
          videoNotes: {
            ...state.videoNotes,
            [topicId]: [...(state.videoNotes[topicId] || []), newNote].sort(
              (a, b) => a.timestampSeconds - b.timestampSeconds
            )
          }
        }));
      },

      deleteVideoNote: (topicId, noteId) => {
        set((state) => ({
          videoNotes: {
            ...state.videoNotes,
            [topicId]: (state.videoNotes[topicId] || []).filter((n) => n.id !== noteId)
          }
        }));
      },

      runAutoPurgeSweep: async () => {
        const { cachedVideos, settings } = get();
        if (!settings.autoPurgeEnabled) return 0;

        let purgedCount = 0;
        const now = Date.now();

        for (const [topicId, item] of Object.entries(cachedVideos)) {
          // Pinned videos are never auto-purged
          if (item.isPinnedOffline) continue;

          if (
            (item.status === 'CACHED_COMPLETE' || item.status === 'cached') &&
            item.isWatched &&
            item.expiresAt
          ) {
            const expireTime = new Date(item.expiresAt).getTime();
            if (now >= expireTime) {
              console.log(
                `[Auto-Purge] Evicting expired local video for "${item.title}" (${settings.retentionDays}d retention reached). Google Drive file remains safe.`
              );
              await deleteCachedVideoFile(item.fileId);

              set((state) => ({
                cachedVideos: {
                  ...state.cachedVideos,
                  [topicId]: {
                    ...item,
                    status: 'NOT_CACHED',
                    localUri: undefined,
                    downloadProgress: 0,
                    downloadedBytes: 0,
                    expiresAt: undefined
                  }
                }
              }));
              purgedCount++;
            }
          }
        }

        return purgedCount;
      },

      getTotalStorageBytes: () => {
        const allItems = Object.values(get().cachedVideos);
        return allItems.reduce((acc, curr) => {
          if (
            (curr.status === 'CACHED_COMPLETE' ||
              curr.status === 'PINNED_COMPLETE' ||
              curr.status === 'cached') &&
            curr.fileSize
          ) {
            return acc + curr.fileSize;
          }
          return acc;
        }, 0);
      }
    }),
    {
      name: 'degreetrack_video_cache_state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cachedVideos: state.cachedVideos,
        videoNotes: state.videoNotes,
        settings: state.settings
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 1. Crash recovery: Incomplete prefetch downloads must NEVER be classified as cached
          const updated = { ...state.cachedVideos };
          let hasInterrupted = false;
          for (const [k, item] of Object.entries(updated)) {
            if (item.status === 'DOWNLOADING' || item.status === 'downloading') {
              updated[k] = {
                ...item,
                status: 'DOWNLOAD_FAILED',
                downloadProgress: 0,
                downloadedBytes: 0,
                errorMsg: 'Download interrupted by app shutdown'
              };
              hasInterrupted = true;
            }
          }
          if (hasInterrupted) {
            useVideoCacheStore.setState({ cachedVideos: updated });
          }

          // 2. Clean up any orphaned .part files on disk
          cleanupOrphanedPartFiles().catch(() => {});

          // 3. Run background auto-purge sweep on app startup
          setTimeout(() => {
            state.runAutoPurgeSweep().catch(() => {});
          }, 2000);
        }
      }
    }
  )
);
