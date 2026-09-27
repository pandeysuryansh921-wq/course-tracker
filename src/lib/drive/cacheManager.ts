import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { VideoCacheItem } from '@/types/video';

const VIDEO_FOLDER = 'cached_videos';

// In-memory web blob storage for non-Capacitor browser preview
const webBlobCache = new Map<string, { blobUrl: string; size: number }>();

export interface ResolvedVideoSource {
  src?: string;
  rawNativeUri?: string;
  directStreamUrl?: string;
  isOffline: boolean;
  isIncomplete?: boolean;
  iframeUrl: string;
}

/**
 * Sweeps and deletes any incomplete .part download files left over from crashes or interrupted downloads.
 */
export async function cleanupOrphanedPartFiles(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  try {
    const list = await Filesystem.readdir({
      path: VIDEO_FOLDER,
      directory: Directory.Data
    });
    let cleaned = 0;
    for (const f of list.files) {
      const fileName = typeof f === 'string' ? f : f.name;
      if (fileName && fileName.endsWith('.part')) {
        try {
          await Filesystem.deleteFile({
            path: `${VIDEO_FOLDER}/${fileName}`,
            directory: Directory.Data
          });
          cleaned++;
          console.log(`[CacheManager] Cleaned orphaned partial download: ${fileName}`);
        } catch {}
      }
    }
    return cleaned;
  } catch {
    return 0;
  }
}

/**
 * Downloads a video file from Google Drive and caches it directly to the local device filesystem.
 * Streams natively to a temporary .part file using Filesystem.downloadFile to avoid loading multi-GB
 * videos into JavaScript memory. Only promotes to final .mp4 upon 100% verified completion.
 */
export async function downloadVideoToDevice(
  fileId: string,
  topicId: string,
  accessToken?: string,
  onProgress?: (percent: number) => void
): Promise<{ localUri: string; fileSize: number }> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  onProgress?.(5);

  if (Capacitor.isNativePlatform()) {
    // 1. Ensure directory exists
    try {
      await Filesystem.mkdir({
        path: VIDEO_FOLDER,
        directory: Directory.Data,
        recursive: true
      });
    } catch {
      // Directory might already exist
    }

    const partFilename = `${VIDEO_FOLDER}/${fileId}.mp4.part`;
    const finalFilename = `${VIDEO_FOLDER}/${fileId}.mp4`;

    // 2. Setup progress listener for native download streaming
    let progressListener: any = null;
    if (onProgress) {
      try {
        progressListener = await Filesystem.addListener('progress', (progress) => {
          if (progress.url && progress.url.includes(fileId)) {
            const pct = progress.contentLength > 0
              ? Math.min(99, Math.round((progress.bytes / progress.contentLength) * 100))
              : 50;
            onProgress(pct);
          }
        });
      } catch (e) {
        console.warn('[CacheManager] Progress listener not attached:', e);
      }
    }

    try {
      // 3. Native streaming download to temporary .part file
      await Filesystem.downloadFile({
        url,
        headers,
        path: partFilename,
        directory: Directory.Data,
        progress: Boolean(onProgress)
      });

      // 4. Verify downloaded partial file
      const statResult = await Filesystem.stat({
        directory: Directory.Data,
        path: partFilename
      });

      const size = statResult?.size || 0;
      if (size <= 0) {
        throw new Error(`Download verification failed: 0 bytes received for file ${fileId}`);
      }

      // 5. Atomic promotion: rename .part to final playable .mp4
      await Filesystem.rename({
        from: partFilename,
        to: finalFilename,
        directory: Directory.Data
      });

      const uriResult = await Filesystem.getUri({
        directory: Directory.Data,
        path: finalFilename
      });

      onProgress?.(100);
      return {
        localUri: uriResult.uri,
        fileSize: size
      };
    } catch (downloadErr) {
      // Clean up partial file on download error or cancellation
      try {
        await Filesystem.deleteFile({
          path: partFilename,
          directory: Directory.Data
        });
      } catch {}
      throw downloadErr;
    } finally {
      if (progressListener) {
        progressListener.remove().catch(() => {});
      }
    }
  } else {
    // Web Fallback: Fetch blob for browser testing
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Failed to download video from Drive (HTTP ${res.status})`);
    }

    onProgress?.(40);
    const contentLength = Number(res.headers.get('content-length') || 0);
    const blob = await res.blob();
    const fileSize = blob.size || contentLength;

    onProgress?.(80);
    const blobUrl = URL.createObjectURL(blob);
    webBlobCache.set(fileId, { blobUrl, size: fileSize });

    onProgress?.(100);
    return {
      localUri: blobUrl,
      fileSize
    };
  }
}

/**
 * Checks if a video is physically present AND confirmed complete in the local device cache.
 * Invariant: INCOMPLETE FILE = NEVER PLAYABLE LOCAL MEDIA.
 */
export async function isVideoCachedLocally(
  fileId: string,
  localUri?: string,
  cacheItem?: { status?: string; isPinnedOffline?: boolean } | null
): Promise<boolean> {
  // If metadata indicates download is not complete, NEVER treat as cached
  if (cacheItem) {
    const isComplete =
      cacheItem.status === 'CACHED_COMPLETE' ||
      cacheItem.status === 'PINNED_COMPLETE' ||
      cacheItem.status === 'cached';
    if (!isComplete) {
      return false;
    }
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const filename = `${VIDEO_FOLDER}/${fileId}.mp4`;
      const stat = await Filesystem.stat({
        path: filename,
        directory: Directory.Data
      });
      return Boolean(stat && stat.size > 0);
    } catch {
      return false;
    }
  } else {
    return Boolean(webBlobCache.has(fileId));
  }
}

/**
 * Deletes a cached video file from local device storage to free up space.
 * Leaves Google Drive untouched.
 */
export async function deleteCachedVideoFile(fileId: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const filename = `${VIDEO_FOLDER}/${fileId}.mp4`;
      const partFilename = `${VIDEO_FOLDER}/${fileId}.mp4.part`;

      // Try deleting final file
      let deleted = false;
      try {
        await Filesystem.deleteFile({
          path: filename,
          directory: Directory.Data
        });
        deleted = true;
      } catch {}

      // Try deleting part file if it exists
      try {
        await Filesystem.deleteFile({
          path: partFilename,
          directory: Directory.Data
        });
        deleted = true;
      } catch {}

      return deleted;
    } else {
      if (webBlobCache.has(fileId)) {
        const item = webBlobCache.get(fileId);
        if (item) URL.revokeObjectURL(item.blobUrl);
        webBlobCache.delete(fileId);
        return true;
      }
      return false;
    }
  } catch (err) {
    console.warn('[Cache Manager] File delete warning (may already be deleted):', err);
    return false;
  }
}

/**
 * Gets the raw native file:// URI for a cached video (for native Media3/ExoPlayer direct playback).
 * Returns null if the file is incomplete, missing, or still a .part file.
 */
export async function getCachedVideoNativeUri(
  fileId: string,
  cacheItem?: { status?: string } | null
): Promise<string | null> {
  const isCached = await isVideoCachedLocally(fileId, undefined, cacheItem);
  if (!isCached) return null;

  if (!Capacitor.isNativePlatform()) {
    const webItem = webBlobCache.get(fileId);
    return webItem ? webItem.blobUrl : null;
  }
  try {
    const filename = `${VIDEO_FOLDER}/${fileId}.mp4`;
    const uriResult = await Filesystem.getUri({
      path: filename,
      directory: Directory.Data
    });
    return uriResult.uri;
  } catch {
    return null;
  }
}

/**
 * Resolves the playable source for a video:
 * 1. If fully cached (CACHED_COMPLETE / PINNED_COMPLETE), returns native device file URL and raw native URI (Offline ready).
 * 2. If downloading, failed, or not cached, immediately returns authenticated Google Drive direct stream URL (Cloud stream).
 * Invariant: Never passes an incomplete local file or .part file to Media3.
 */
export async function resolveVideoSource(
  fileId: string,
  localUri?: string,
  accessToken?: string,
  cacheItem?: { status?: string; isPinnedOffline?: boolean } | null
): Promise<ResolvedVideoSource> {
  const iframeUrl = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
  const cached = await isVideoCachedLocally(fileId, localUri, cacheItem);

  if (cached) {
    if (Capacitor.isNativePlatform()) {
      const filename = `${VIDEO_FOLDER}/${fileId}.mp4`;
      const uriResult = await Filesystem.getUri({
        path: filename,
        directory: Directory.Data
      });
      const playableSrc = Capacitor.convertFileSrc(uriResult.uri);
      return {
        src: playableSrc,
        rawNativeUri: uriResult.uri,
        isOffline: true,
        isIncomplete: false,
        iframeUrl
      };
    } else {
      const webItem = webBlobCache.get(fileId);
      if (webItem) {
        return {
          src: webItem.blobUrl,
          rawNativeUri: webItem.blobUrl,
          isOffline: true,
          isIncomplete: false,
          iframeUrl
        };
      }
    }
  }

  // Not fully cached locally -> Cloud Direct Stream Mode
  const directStreamUrl = accessToken
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
    : undefined;

  const isDownloading = cacheItem?.status === 'DOWNLOADING' || cacheItem?.status === 'downloading';

  return {
    src: directStreamUrl,
    directStreamUrl,
    isOffline: false,
    isIncomplete: isDownloading,
    iframeUrl
  };
}

/**
 * Formats bytes to human-readable size (e.g. 450 MB, 1.2 GB).
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
