import { registerPlugin, Capacitor } from '@capacitor/core';
import { VideoNote } from '@/types/video';
import { playbackDiagnostics } from './playbackDiagnostics';

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
  hasError?: boolean;
  errorMessage?: string;
  errorCode?: number;
  errorCodeName?: string;
  httpStatus?: number;
  errorDetails?: string;
}

export interface NativeLecturePlayerPlugin {
  isNativePlayerAvailable(): Promise<{ available: boolean }>;
  playLecture(options: PlayLectureOptions): Promise<PlayLectureResult>;
}

export const NativeLecturePlayer = registerPlugin<NativeLecturePlayerPlugin>('LecturePlayer');

/**
 * Checks whether native Android Media3 ExoPlayer is available on the current device.
 * Emits numbered log [PLAYER_TRACE_05].
 */
export async function isMedia3ExoPlayerAvailable(): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  console.log(`[PLAYER_TRACE_05] Checking Media3 availability: isNative=${isNative}, platform=${platform}`);

  if (!isNative || platform !== 'android') {
    const reason = `Not native Android (isNative=${isNative}, platform=${platform})`;
    console.warn(`[PLAYER_TRACE_05] Media3 unavailable: ${reason}`);
    playbackDiagnostics.recordStep('05', 'failed', reason);
    return false;
  }

  try {
    playbackDiagnostics.recordStep('05', 'running', 'Querying LecturePlayer.isNativePlayerAvailable()');
    const res = await NativeLecturePlayer.isNativePlayerAvailable();
    const available = Boolean(res?.available);
    console.log(`[PLAYER_TRACE_05] NativeLecturePlayer.isNativePlayerAvailable returned: available=${available}`);
    if (available) {
      playbackDiagnostics.recordStep('05', 'success', 'Media3 plugin available');
    } else {
      playbackDiagnostics.recordStep('05', 'failed', 'Plugin returned available=false');
    }
    return available;
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.warn(`[PLAYER_TRACE_05] NativeLecturePlayer.isNativePlayerAvailable threw exception: ${errMsg}`);
    playbackDiagnostics.recordStep('05', 'failed', `Bridge exception: ${errMsg}`);
    return false;
  }
}

/**
 * Dispatches playLecture across Capacitor bridge with PLAYER_TRACE_08 logging.
 */
export async function playNativeLecture(options: PlayLectureOptions): Promise<PlayLectureResult> {
  const sanitizedToken = options.accessToken
    ? `${options.accessToken.substring(0, 8)}... (len: ${options.accessToken.length})`
    : 'None';

  console.log('[PLAYER_TRACE_08] NativeLecturePlayer.playLecture() invoking across bridge:', {
    fileId: options.fileId,
    videoUrl: options.videoUrl,
    hasToken: Boolean(options.accessToken),
    tokenSanitized: sanitizedToken,
    title: options.title,
    courseTitle: options.courseTitle,
    topicId: options.topicId,
    currentTime: options.currentTime,
    isOffline: options.isOffline,
  });

  playbackDiagnostics.recordStep('08', 'running', `playLecture called (fileId: ${options.fileId})`);

  try {
    const result = await NativeLecturePlayer.playLecture(options);
    console.log('[PLAYER_TRACE_08] NativeLecturePlayer.playLecture() result received from bridge:', result);

    if (result.hasError) {
      playbackDiagnostics.recordStep(
        '08',
        'failed',
        `Native error: ${result.errorMessage || 'Playback error'} (code: ${result.errorCodeName || result.errorCode})`
      );
      playbackDiagnostics.recordStep('10', 'failed', result.errorMessage);
    } else if (result.cancelled) {
      playbackDiagnostics.recordStep('08', 'success', 'Player closed / cancelled by user');
    } else {
      playbackDiagnostics.recordStep('08', 'success', 'Playback completed successfully');
      playbackDiagnostics.recordStep('10', 'success', `Progress: ${result.watchedPercentage || 0}%`);
    }

    return result;
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error(`[PLAYER_TRACE_08] NativeLecturePlayer.playLecture() rejected: ${errMsg}`, err);
    playbackDiagnostics.recordStep('08', 'failed', `Bridge call rejected: ${errMsg}`);
    throw err;
  }
}
