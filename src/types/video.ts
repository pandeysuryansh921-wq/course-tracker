export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
}

export interface DetectedLecture {
  id: string; // Drive file id
  title: string;
  cleanName: string;
  sequenceNumber: number;
  fileSize?: number;
  mimeType: string;
  driveUrl: string;
  slidesFile?: DriveFileItem;
  notesFile?: DriveFileItem;
}

export interface DetectedModule {
  id: string;
  name: string;
  order: number;
  lectures: DetectedLecture[];
}

export interface DriveScanResult {
  courseName: string;
  folderId: string;
  totalLectures: number;
  totalSlides: number;
  modules: DetectedModule[];
  rawFilesCount: number;
}

export interface VideoCacheItem {
  topicId: string;
  fileId: string;
  title: string;
  courseId: string;
  localUri?: string;
  fileSize?: number;
  status: 'idle' | 'downloading' | 'cached' | 'error';
  downloadProgress?: number;
  watchedPercentage: number;
  isWatched: boolean;
  watchedAt?: string;
  expiresAt?: string; // ISO date string when 3-day retention expires
  errorMsg?: string;
}

export interface VideoNote {
  id: string;
  topicId: string;
  timestampSeconds: number;
  text: string;
  createdAt: string;
}

export interface VideoCacheSettings {
  prefetchCount: number; // 1, 2, or 3 lectures
  retentionDays: number; // e.g. 1, 3, 7 days
  wifiOnly: boolean;
  autoPurgeEnabled: boolean;
}
