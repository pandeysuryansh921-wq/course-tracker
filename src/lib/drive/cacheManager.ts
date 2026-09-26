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
  iframeUrl: string;
}

/**
 * Downloads a video file from Google Drive and caches it directly to the local device filesystem.
 * Streams natively using Filesystem.downloadFile to avoid loading multi-GB videos into JavaScript memory.
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

    const filename = `${VIDEO_FOLDER}/${fileId}.mp4`;

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
      // 3. Native streaming download (Direct socket to disk, zero JS memory overhead)
      await Filesystem.downloadFile({
        url,
        headers,
        path: filename,
        directory: Directory.Data,
        progress: Boolean(onProgress)
      });

      const uriResult = await Filesystem.getUri({
        directory: Directory.Data,
        path: filename
      });

      let size = 0;
      try {
        const statResult = await Filesystem.stat({
          directory: Directory.Data,
          path: filename
        });
        size = statResult.size || 0;
      } catch {}

      onProgress?.(100);
      return {
        localUri: uriResult.uri,
        fileSize: size
      };
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
 * Checks if a video is physically present in the local device cache.
 */
export async function isVideoCachedLocally(fileId: string, localUri?: string): Promise<boolean> {
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
      await Filesystem.deleteFile({
        path: filename,
        directory: Directory.Data
      });
      return true;
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
 */
export async function getCachedVideoNativeUri(fileId: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    const webItem = webBlobCache.get(fileId);
    return webItem ? webItem.blobUrl : null;
  }
  try {
    const filename = `${VIDEO_FOLDER}/${fileId}.mp4`;
    const stat = await Filesystem.stat({
      path: filename,
      directory: Directory.Data
    });
    if (stat && stat.size > 0) {
      const uriResult = await Filesystem.getUri({
        path: filename,
        directory: Directory.Data
      });
      return uriResult.uri;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves the playable source for a video:
 * 1. If local cache exists, returns native device file URL and raw native URI (Offline ready).
 * 2. If not cached, returns Google Drive stream / preview embed URL (Direct streaming).
 */
export async function resolveVideoSource(
  fileId: string,
  localUri?: string,
  accessToken?: string
): Promise<ResolvedVideoSource> {
  const iframeUrl = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
  const cached = await isVideoCachedLocally(fileId, localUri);

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
        iframeUrl
      };
    } else {
      const webItem = webBlobCache.get(fileId);
      if (webItem) {
        return {
          src: webItem.blobUrl,
          rawNativeUri: webItem.blobUrl,
          isOffline: true,
          iframeUrl
        };
      }
    }
  }

  // Not cached locally -> Direct Cloud Stream Mode
  const directStreamUrl = accessToken
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
    : undefined;

  return {
    src: directStreamUrl,
    directStreamUrl,
    isOffline: false,
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
