import { registerPlugin, Capacitor } from '@capacitor/core';
import { VideoNote } from '@/types/video';

export interface PlayLectureOptions {
  fileId: string;
  videoUrl: string;
  accessToken?: string;
  title: string;
  courseTitle: string;
  topicId: string;
  currentTime?: number;
  duration?: number;
  isOffline?: boolean;
  nextTopic?: {
    topicId: string;
    title: string;
    videoUrl?: string;
    fileId?: string;
  };
}

export interface PlayLectureResult {
  topicId?: string;
  currentTime?: number;
  duration?: number;
  isCompleted?: boolean;
  watchedPercentage?: number;
  notesAdded?: VideoNote[];
  nextRequested?: boolean;
  nextTopicId?: string;
  cancelled?: boolean;
}

export interface NativeLecturePlayerPlugin {
  isNativePlayerAvailable(): Promise<{ available: boolean }>;
  playLecture(options: PlayLectureOptions): Promise<PlayLectureResult>;
}

export const NativeLecturePlayer = registerPlugin<NativeLecturePlayerPlugin>('LecturePlayer');

/**
 * Checks whether native Android Media3 ExoPlayer is available on the current device.
 */
export async function isMedia3ExoPlayerAvailable(): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  console.log('[LecturePlayerBridge] Checking Media3 availability: isNative =', isNative, ', platform =', platform);

  if (!isNative || platform !== 'android') {
    console.log('[LecturePlayerBridge] Not native Android, returning false.');
    return false;
  }

  try {
    const res = await NativeLecturePlayer.isNativePlayerAvailable();
    console.log('[LecturePlayerBridge] NativeLecturePlayer.isNativePlayerAvailable result:', res);
    return Boolean(res?.available);
  } catch (err) {
    console.warn('[LecturePlayerBridge] NativeLecturePlayer.isNativePlayerAvailable threw exception:', err);
    return false;
  }
}
