import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { VideoCacheItem, VideoNote, VideoCacheSettings } from '@/types/video';
import { downloadVideoToDevice, deleteCachedVideoFile, isVideoCachedLocally } from '@/lib/drive/cacheManager';
import { useCurriculumStore } from '@/stores/useCurriculumStore';

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
  startPrefetchQueue: (courseId: string, currentTopicId: string, accessToken?: string) => Promise<void>;
  recordProgress: (topicId: string, currentTime: number, duration: number) => void;
  addVideoNote: (topicId: string, timestampSeconds: number, text: string) => void;
  deleteVideoNote: (topicId: string, noteId: string) => void;
  runAutoPurgeSweep: () => Promise<number>;
  getTotalStorageBytes: () => number;
}

const DEFAULT_SETTINGS: VideoCacheSettings = {
  prefetchCount: 2,
  retentionDays: 3,
  wifiOnly: false,
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

      downloadVideo: async (topicId, fileId, title, courseId, accessToken) => {
        const existing = get().cachedVideos[topicId];
        if (existing?.status === 'downloading') return false;

        // Set state to downloading
        set((state) => ({
          cachedVideos: {
            ...state.cachedVideos,
            [topicId]: {
              topicId,
              fileId,
              title,
              courseId,
              status: 'downloading',
              downloadProgress: 0,
              watchedPercentage: existing?.watchedPercentage || 0,
              isWatched: existing?.isWatched || false,
              watchedAt: existing?.watchedAt,
              expiresAt: existing?.expiresAt
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
                    [topicId]: { ...item, downloadProgress: pct }
                  }
                };
              });
            }
          );

          set((state) => ({
            cachedVideos: {
              ...state.cachedVideos,
              [topicId]: {
                ...state.cachedVideos[topicId],
                status: 'cached',
                localUri,
                fileSize,
                downloadProgress: 100,
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
                status: 'error',
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
              status: 'idle',
              localUri: undefined,
              downloadProgress: 0,
              expiresAt: undefined
            }
          }
        }));

        return true;
      },

      clearAllCache: async () => {
        const allItems = Object.values(get().cachedVideos);
        for (const item of allItems) {
          if (item.status === 'cached' || item.localUri) {
            await deleteCachedVideoFile(item.fileId);
          }
        }

        set((state) => {
          const updated = { ...state.cachedVideos };
          Object.keys(updated).forEach((k) => {
            updated[k] = {
              ...updated[k],
              status: 'idle',
              localUri: undefined,
              downloadProgress: 0,
              expiresAt: undefined
            };
          });
          return { cachedVideos: updated };
        });
      },

      startPrefetchQueue: async (courseId, currentTopicId, accessToken) => {
        const settings = get().settings;
        if (settings.prefetchCount <= 0) return;

        // Find upcoming video topics in sequence for this course
        const curriculumStore = useCurriculumStore.getState();
        const courseTopics = curriculumStore.topics
          .filter((t) => t.courseId === courseId)
          .sort((a, b) => a.order - b.order);

        const currentIndex = courseTopics.findIndex((t) => t.id === currentTopicId);
        if (currentIndex === -1) return;

        // Take next N topics
        const upcoming = courseTopics.slice(currentIndex + 1, currentIndex + 1 + settings.prefetchCount);

        for (const nextTopic of upcoming) {
          // Check if this topic has a Drive video
          const topicResources = curriculumStore.resources.filter((r) => r.topicId === nextTopic.id);
          const videoRes = topicResources.find((r) => r.type === 'video');

          if (videoRes && videoRes.url) {
            // Extract Drive file ID if present
            const fileIdMatch = videoRes.url.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
            const fileId = fileIdMatch ? fileIdMatch[1] : undefined;

            if (fileId) {
              const currentCache = get().cachedVideos[nextTopic.id];
              const isAlreadyCached = currentCache?.status === 'cached' || (await isVideoCachedLocally(fileId));

              if (!isAlreadyCached && currentCache?.status !== 'downloading') {
                console.log(`[Rolling Cache] Prefetching next lecture in background: "${nextTopic.name}"`);
                // Silently download in background
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
          const isNowWatched = wasWatched || pct >= 80;

          let expiresAt = item?.expiresAt;
          let watchedAt = item?.watchedAt;

          // When transitioning to watched (>= 80%):
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
          if (item.status === 'cached' && item.isWatched && item.expiresAt) {
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
                    status: 'idle',
                    localUri: undefined,
                    downloadProgress: 0,
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
          if (curr.status === 'cached' && curr.fileSize) {
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
          // Run background auto-purge sweep on app startup
          setTimeout(() => {
            state.runAutoPurgeSweep().catch(() => {});
          }, 2000);
        }
      }
    }
  )
);
