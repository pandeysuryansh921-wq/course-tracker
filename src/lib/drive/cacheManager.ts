import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { VideoCacheItem } from '@/types/video';

const VIDEO_FOLDER = 'cached_videos';

// In-memory web blob storage for non-Capacitor browser preview
const webBlobCache = new Map<string, { blobUrl: string; size: number }>();

/**
 * Downloads a video file from Google Drive and caches it to the local device filesystem.
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

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to download video from Drive (HTTP ${res.status})`);
  }

  onProgress?.(30);

  const contentLength = Number(res.headers.get('content-length') || 0);
  const blob = await res.blob();
  const fileSize = blob.size || contentLength;

  onProgress?.(70);

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

    // 2. Convert Blob to Base64 for Capacitor Filesystem
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const b64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const filename = `${VIDEO_FOLDER}/${fileId}.mp4`;
    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Data
    });

    onProgress?.(100);
    return {
      localUri: saved.uri,
      fileSize
    };
  } else {
    // Web Fallback: Keep Blob URL in memory/indexed cache
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
      return stat && stat.size > 0;
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
 * Resolves the playable source for a video:
 * 1. If local cache exists, returns the native device file URL (Offline ready).
 * 2. If not cached, returns Google Drive stream / preview embed URL (Direct streaming).
 */
export async function resolveVideoSource(
  fileId: string,
  localUri?: string,
  accessToken?: string
): Promise<{
  src?: string;
  isOffline: boolean;
  iframeUrl: string;
}> {
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
        isOffline: true,
        iframeUrl
      };
    } else {
      const webItem = webBlobCache.get(fileId);
      if (webItem) {
        return {
          src: webItem.blobUrl,
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
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
