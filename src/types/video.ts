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

export type DetectedResourceType = 'video' | 'pdf' | 'photo' | 'other';

export interface DetectedResource {
  id: string; // Drive file id
  name: string;
  cleanTitle: string;
  resourceType: DetectedResourceType;
  mimeType: string;
  fileSize?: number;
  driveUrl: string;
  modifiedTime?: string;
  parentFolderId?: string;
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

export interface DetectedTopic {
  id: string; // Topic folder id or generated id
  name: string;
  order: number;
  resources: DetectedResource[];
  lectures: DetectedLecture[]; // Backward compat
}

export interface DetectedModule {
  id: string; // Module folder id
  name: string;
  order: number;
  topics: DetectedTopic[];
  moduleResources: DetectedResource[]; // Section 7: Module-level resources
  lectures: DetectedLecture[]; // Backward compat
}

export interface DriveScanResult {
  courseName: string;
  folderId: string;
  courseResources: DetectedResource[]; // Section 8: Course-level resources
  modules: DetectedModule[];
  totalModules: number;
  totalTopics: number;
  totalLectures: number; // Video count
  totalSlides: number; // PDF count
  totalImages: number;
  totalOthers: number;
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
  expiresAt?: string; // ISO date string when retention expires
  currentTime?: number; // Position in seconds for resume (Section 18)
  duration?: number;
  lastPlayedAt?: string;
  isPinnedOffline?: boolean; // Keep Offline toggle (Section 27)
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
  prefetchCount: number; // 0, 1, 2, 3, 5 lectures (default 2)
  retentionDays: number; // 0 (immediately), 1, 3, 7, -1 (never) (default 3)
  maxCacheBytes: number; // default 5GB
  wifiOnly: boolean; // default true
  allowMobileData: boolean; // default false
  requireChargingOnly: boolean; // default false
  autoPurgeEnabled: boolean; // default true
}
