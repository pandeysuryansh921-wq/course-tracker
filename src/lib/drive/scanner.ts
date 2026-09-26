import { 
  DriveFileItem, 
  DetectedLecture, 
  DetectedModule, 
  DetectedTopic, 
  DetectedResource, 
  DetectedResourceType, 
  DriveScanResult 
} from '@/types/video';
import { generateStructuredCompletion } from '@/lib/ai/client';

/**
 * Extracts a Google Drive Folder ID from a raw ID or full Google Drive URL.
 */
export function extractFolderId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Matches: drive.google.com/drive/folders/FOLDER_ID or drive/u/0/folders/FOLDER_ID
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // 2. Matches: drive.google.com/open?id=FOLDER_ID or ?id=FOLDER_ID
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }

  // 3. Raw alphanumeric ID: typically 20 to 55 alphanumeric characters
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Natural Alphanumeric Comparison for sorting filenames like humans expect:
 * "01 Intro", "02 Bones", "10 Muscles" (numerical ascending).
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Extracts a sequential number from a video or topic filename.
 */
export function extractSequenceNumber(filename: string): number {
  const clean = filename.toLowerCase();

  // Leading numbers like "01_...", "01 - ...", "01. ..."
  const leadingMatch = clean.match(/^0*(\d+)[_.\-\s]/);
  if (leadingMatch) return parseInt(leadingMatch[1], 10);

  // Keyword followed by number "lecture 03", "lec 3", "class 3", "part 2", "week 2"
  const keywordMatch = clean.match(/(?:lec(?:ture)?|class|session|part|module|topic|week|w|p|c)[\s._\-#]*(\d+)/i);
  if (keywordMatch) return parseInt(keywordMatch[1], 10);

  // Trailing number before extension "Intro - 05.mp4"
  const trailingMatch = clean.match(/[\s._\-#](\d+)(?:\.[a-z0-9]+)?$/i);
  if (trailingMatch) return parseInt(trailingMatch[1], 10);

  // Any first standalone digits
  const anyDigitsMatch = clean.match(/(\d+)/);
  if (anyDigitsMatch) return parseInt(anyDigitsMatch[1], 10);

  return 9999;
}

/**
 * Strips extensions and numbering prefixes to produce a human-friendly lecture/topic title.
 */
export function cleanLectureTitle(filename: string): string {
  let name = filename.replace(/\.(mp4|mkv|webm|avi|mov|m4v|flv|pdf|png|jpg|jpeg|webp)$/i, '');

  // Strip leading prefixes like "01_", "01 - ", "Lecture 1 - ", "Lec 01: "
  name = name.replace(/^(\d+[\s._\-]+)+/, '');
  name = name.replace(/^(lecture|lec|class|session|part|topic|module)[\s._\-#]*\d+[\s._\-:]*/i, '');

  // Replace underscores and multiple dashes with spaces
  name = name.replace(/[_-]+/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();

  // If name became empty, revert to original without extension
  if (!name) {
    name = filename.replace(/\.[^/.]+$/, '');
  }

  // Capitalize first letter of words
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];
const SLIDE_EXTENSIONS = ['.pdf'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'];

/**
 * Classifies a Google Drive file by MIME type first, falling back to extension (Section 9).
 */
export function classifyResource(file: DriveFileItem): {
  resourceType: DetectedResourceType;
  cleanTitle: string;
} {
  const mime = (file.mimeType || '').toLowerCase();
  const lowerName = file.name.toLowerCase();

  let resourceType: DetectedResourceType = 'other';

  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
    resourceType = 'video';
  } else if (mime === 'application/pdf' || SLIDE_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
    resourceType = 'pdf';
  } else if (mime.startsWith('image/') || IMAGE_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
    resourceType = 'photo';
  } else {
    resourceType = 'other';
  }

  return {
    resourceType,
    cleanTitle: cleanLectureTitle(file.name),
  };
}

export function isVideoFile(file: DriveFileItem): boolean {
  return classifyResource(file).resourceType === 'video';
}

export function isSlideFile(file: DriveFileItem): boolean {
  return classifyResource(file).resourceType === 'pdf';
}

/**
 * Internal helper to query items within a specific Drive parent folder with pagination.
 */
async function fetchFolderContents(
  folderId: string,
  authHeader: Record<string, string>,
  keyParam: string
): Promise<{ files: DriveFileItem[]; subfolders: { id: string; name: string }[] }> {
  const files: DriveFileItem[] = [];
  const subfolders: { id: string; name: string }[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const query = `'${folderId}' in parents and trashed = false`;
    const fields = 'nextPageToken,files(id,name,mimeType,size,webViewLink,webContentLink,parents,createdTime,modifiedTime)';
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=100&fields=${encodeURIComponent(fields)}${tokenParam}${keyParam}`;

    const res = await fetch(url, { headers: authHeader });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errorMsg = errData?.error?.message || `Google Drive API error (status ${res.status})`;
      const err: any = new Error(errorMsg);
      err.status = res.status;
      err.isAuthError =
        res.status === 401 ||
        res.status === 403 ||
        errorMsg.toLowerCase().includes('invalid authentication credentials') ||
        errorMsg.toLowerCase().includes('expected oauth 2 access token') ||
        errorMsg.toLowerCase().includes('unauthenticated');
      throw err;
    }

    const data = await res.json();
    if (data.files && Array.isArray(data.files)) {
      for (const item of data.files) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          subfolders.push({ id: item.id, name: item.name });
        } else {
          files.push(item);
        }
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { files, subfolders };
}

/**
 * Deterministic 3-Tier Hierarchy Parser (Section 2, 6, 7, 8):
 * - Root Folder = Course Name
 * - Files in Root = Course Resources (Section 8)
 * - Level 1 Folders = Modules
 * - Files in Level 1 = Module Resources (Section 7)
 * - Level 2 Folders = Topics
 * - Files in Level 2 = Topic Resources (Section 6)
 */
export async function fetchDeterministicCourseHierarchy(
  rootFolderId: string,
  authConfig: { accessToken?: string; apiKey?: string }
): Promise<DriveScanResult> {
  const { accessToken, apiKey } = authConfig;
  const authHeader: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';

  // 1. Fetch Root Folder Info
  let courseName = 'Google Drive Course';
  try {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${rootFolderId}?fields=id,name,mimeType${keyParam}`,
      { headers: authHeader }
    );
    if (!metaRes.ok && (metaRes.status === 401 || metaRes.status === 403)) {
      const errData = await metaRes.json().catch(() => ({}));
      const errorMsg = errData?.error?.message || `Google Drive authentication error (status ${metaRes.status})`;
      const err: any = new Error(errorMsg);
      err.status = metaRes.status;
      err.isAuthError = true;
      throw err;
    }
    if (metaRes.ok) {
      const meta = await metaRes.json();
      if (meta.name) courseName = meta.name;
    }
  } catch (err: any) {
    if (err.isAuthError) throw err;
    console.warn('[Drive Scanner] Could not fetch course root metadata:', err);
  }

  // 2. Fetch Level 0 (Root Course folder)
  const rootContents = await fetchFolderContents(rootFolderId, authHeader, keyParam);

  const courseResources: DetectedResource[] = rootContents.files.map(f => {
    const info = classifyResource(f);
    return {
      id: f.id,
      name: f.name,
      cleanTitle: info.cleanTitle,
      resourceType: info.resourceType,
      mimeType: f.mimeType || 'application/octet-stream',
      fileSize: f.size ? Number(f.size) : undefined,
      driveUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      modifiedTime: f.modifiedTime,
      parentFolderId: rootFolderId,
    };
  }).sort((a, b) => naturalCompare(a.name, b.name));

  // Sort Level 1 Module Folders naturally
  const moduleFolders = rootContents.subfolders.sort((a, b) => naturalCompare(a.name, b.name));

  const modules: DetectedModule[] = [];
  let totalLectures = 0;
  let totalSlides = 0;
  let totalImages = 0;
  let totalOthers = 0;
  let rawFilesCount = courseResources.length;

  for (let mIdx = 0; mIdx < moduleFolders.length; mIdx++) {
    const modFolder = moduleFolders[mIdx];
    const modContents = await fetchFolderContents(modFolder.id, authHeader, keyParam);
    rawFilesCount += modContents.files.length;

    // Module-level resources (Section 7)
    const moduleResources: DetectedResource[] = modContents.files.map(f => {
      const info = classifyResource(f);
      return {
        id: f.id,
        name: f.name,
        cleanTitle: info.cleanTitle,
        resourceType: info.resourceType,
        mimeType: f.mimeType || 'application/octet-stream',
        fileSize: f.size ? Number(f.size) : undefined,
        driveUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        modifiedTime: f.modifiedTime,
        parentFolderId: modFolder.id,
      };
    }).sort((a, b) => naturalCompare(a.name, b.name));

    // Sort Level 2 Topic Folders naturally
    const topicFolders = modContents.subfolders.sort((a, b) => naturalCompare(a.name, b.name));
    const topics: DetectedTopic[] = [];
    const moduleLecturesLegacy: DetectedLecture[] = [];

    // Case A: Level 2 folders exist -> deterministic Topics
    if (topicFolders.length > 0) {
      for (let tIdx = 0; tIdx < topicFolders.length; tIdx++) {
        const topFolder = topicFolders[tIdx];
        const topContents = await fetchFolderContents(topFolder.id, authHeader, keyParam);
        rawFilesCount += topContents.files.length;

        const topicResources: DetectedResource[] = topContents.files.map(f => {
          const info = classifyResource(f);
          return {
            id: f.id,
            name: f.name,
            cleanTitle: info.cleanTitle,
            resourceType: info.resourceType,
            mimeType: f.mimeType || 'application/octet-stream',
            fileSize: f.size ? Number(f.size) : undefined,
            driveUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
            modifiedTime: f.modifiedTime,
            parentFolderId: topFolder.id,
          };
        }).sort((a, b) => naturalCompare(a.name, b.name));

        // Group into legacy DetectedLecture format for compatibility
        const topicLectures: DetectedLecture[] = topicResources
          .filter(r => r.resourceType === 'video')
          .map(v => {
            const pairedSlide = topicResources.find(r => r.resourceType === 'pdf');
            return {
              id: v.id,
              title: v.name,
              cleanName: v.cleanTitle,
              sequenceNumber: extractSequenceNumber(v.name),
              fileSize: v.fileSize,
              mimeType: v.mimeType,
              driveUrl: v.driveUrl,
              slidesFile: pairedSlide ? {
                id: pairedSlide.id,
                name: pairedSlide.name,
                mimeType: pairedSlide.mimeType,
                size: pairedSlide.fileSize,
                webViewLink: pairedSlide.driveUrl,
              } : undefined,
            };
          });

        moduleLecturesLegacy.push(...topicLectures);

        topics.push({
          id: topFolder.id,
          name: topFolder.name,
          order: tIdx + 1,
          resources: topicResources,
          lectures: topicLectures,
        });
      }
    } else {
      // Case B: Module has files directly inside but no Level 2 subfolders
      // Group resources into a single topic representing this module, or create topics per video
      const videosInModule = moduleResources.filter(r => r.resourceType === 'video');
      if (videosInModule.length > 0) {
        for (let vIdx = 0; vIdx < videosInModule.length; vIdx++) {
          const vid = videosInModule[vIdx];
          const pairedSlide = moduleResources.find(r => r.resourceType === 'pdf');
          const lec: DetectedLecture = {
            id: vid.id,
            title: vid.name,
            cleanName: vid.cleanTitle,
            sequenceNumber: extractSequenceNumber(vid.name),
            fileSize: vid.fileSize,
            mimeType: vid.mimeType,
            driveUrl: vid.driveUrl,
            slidesFile: pairedSlide ? {
              id: pairedSlide.id,
              name: pairedSlide.name,
              mimeType: pairedSlide.mimeType,
              size: pairedSlide.fileSize,
              webViewLink: pairedSlide.driveUrl,
            } : undefined,
          };
          moduleLecturesLegacy.push(lec);
          topics.push({
            id: `top-${vid.id}`,
            name: vid.cleanTitle,
            order: vIdx + 1,
            resources: [vid],
            lectures: [lec],
          });
        }
      } else {
        // Only documents / notes
        topics.push({
          id: `top-mod-${modFolder.id}`,
          name: `${modFolder.name} Materials`,
          order: 1,
          resources: moduleResources,
          lectures: [],
        });
      }
    }

    modules.push({
      id: modFolder.id,
      name: modFolder.name,
      order: mIdx + 1,
      topics,
      moduleResources,
      lectures: moduleLecturesLegacy,
    });
  }

  // Count resource totals across all tiers
  const countInResources = (items: DetectedResource[]) => {
    for (const item of items) {
      if (item.resourceType === 'video') totalLectures++;
      else if (item.resourceType === 'pdf') totalSlides++;
      else if (item.resourceType === 'photo') totalImages++;
      else totalOthers++;
    }
  };

  countInResources(courseResources);
  for (const mod of modules) {
    countInResources(mod.moduleResources);
    for (const top of mod.topics) {
      countInResources(top.resources);
    }
  }

  const totalTopics = modules.reduce((acc, m) => acc + m.topics.length, 0);

  return {
    courseName,
    folderId: rootFolderId,
    courseResources,
    modules,
    totalModules: modules.length,
    totalTopics,
    totalLectures,
    totalSlides,
    totalImages,
    totalOthers,
    rawFilesCount,
  };
}

/**
 * Backward compatibility wrapper for fetchDriveFolderHierarchy.
 */
export async function fetchDriveFolderHierarchy(
  folderId: string,
  authConfig: { accessToken?: string; apiKey?: string }
): Promise<{ folderName: string; files: DriveFileItem[]; subfolders: { id: string; name: string }[] }> {
  const result = await fetchDeterministicCourseHierarchy(folderId, authConfig);
  const flattenedFiles: DriveFileItem[] = [];
  
  result.courseResources.forEach(r => {
    flattenedFiles.push({
      id: r.id,
      name: r.name,
      mimeType: r.mimeType,
      size: r.fileSize,
      webViewLink: r.driveUrl,
    });
  });

  result.modules.forEach(m => {
    m.moduleResources.forEach(r => {
      flattenedFiles.push({
        id: r.id,
        name: r.name,
        mimeType: r.mimeType,
        size: r.fileSize,
        webViewLink: r.driveUrl,
        parents: [m.id],
      });
    });
    m.topics.forEach(t => {
      t.resources.forEach(r => {
        flattenedFiles.push({
          id: r.id,
          name: r.name,
          mimeType: r.mimeType,
          size: r.fileSize,
          webViewLink: r.driveUrl,
          parents: [t.id],
        });
      });
    });
  });

  const subfolders = result.modules.map(m => ({ id: m.id, name: m.name }));
  return { folderName: result.courseName, files: flattenedFiles, subfolders };
}

/**
 * Differential Sync Detector (Section 33 & 34):
 * Detects newly added, renamed, or missing files between Google Drive and DegreeTrack.
 */
export interface CourseDiffResult {
  newResources: DetectedResource[];
  renamedResources: { existingId: string; oldTitle: string; newTitle: string; driveFileId: string }[];
  missingResources: { existingId: string; title: string; driveFileId: string }[];
  newTopics: DetectedTopic[];
  newModules: DetectedModule[];
  summary: string;
}

export function diffCourseWithDrive(
  scanResult: DriveScanResult,
  existingResources: { id: string; driveFileId?: string; title: string; isMissingSource?: boolean }[],
  existingTopics: { id: string; driveFolderId?: string; name: string }[],
  existingModules: { id: string; driveFolderId?: string; name: string }[]
): CourseDiffResult {
  const existingByDriveId = new Map<string, { id: string; title: string; driveFileId?: string }>();
  for (const r of existingResources) {
    if (r.driveFileId) {
      existingByDriveId.set(r.driveFileId, r);
    }
  }

  const existingTopicFolderIds = new Set(existingTopics.map(t => t.driveFolderId).filter(Boolean));
  const existingModuleFolderIds = new Set(existingModules.map(m => m.driveFolderId).filter(Boolean));

  const allScannedResources: DetectedResource[] = [
    ...scanResult.courseResources,
  ];

  for (const m of scanResult.modules) {
    allScannedResources.push(...m.moduleResources);
    for (const t of m.topics) {
      allScannedResources.push(...t.resources);
    }
  }

  const scannedDriveFileIds = new Set(allScannedResources.map(r => r.id));

  const newResources: DetectedResource[] = [];
  const renamedResources: { existingId: string; oldTitle: string; newTitle: string; driveFileId: string }[] = [];
  const missingResources: { existingId: string; title: string; driveFileId: string }[] = [];

  for (const r of allScannedResources) {
    const existing = existingByDriveId.get(r.id);
    if (!existing) {
      newResources.push(r);
    } else if (existing.title !== r.name && existing.title !== r.cleanTitle) {
      renamedResources.push({
        existingId: existing.id,
        oldTitle: existing.title,
        newTitle: r.cleanTitle || r.name,
        driveFileId: r.id,
      });
    }
  }

  for (const [driveId, existing] of existingByDriveId.entries()) {
    if (!scannedDriveFileIds.has(driveId)) {
      missingResources.push({
        existingId: existing.id,
        title: existing.title,
        driveFileId: driveId,
      });
    }
  }

  const newModules = scanResult.modules.filter(m => !existingModuleFolderIds.has(m.id));
  const newTopics: DetectedTopic[] = [];
  for (const m of scanResult.modules) {
    for (const t of m.topics) {
      if (!existingTopicFolderIds.has(t.id)) {
        newTopics.push(t);
      }
    }
  }

  const newVids = newResources.filter(r => r.resourceType === 'video').length;
  const newDocs = newResources.filter(r => r.resourceType === 'pdf').length;

  const summaryParts: string[] = [];
  if (newVids > 0) summaryParts.push(`+ ${newVids} new lectures`);
  if (newDocs > 0) summaryParts.push(`+ ${newDocs} new documents`);
  if (renamedResources.length > 0) summaryParts.push(`~ ${renamedResources.length} renamed`);
  if (missingResources.length > 0) summaryParts.push(`- ${missingResources.length} unavailable`);
  if (summaryParts.length === 0) summaryParts.push('Course is up to date with Google Drive.');

  return {
    newResources,
    renamedResources,
    missingResources,
    newTopics,
    newModules,
    summary: summaryParts.join(', '),
  };
}

/**
 * AI-Assisted Course Organizer:
 * Uses Gemini BYOK optionally without altering Google Drive files.
 */
export async function aiStructureDriveFiles(
  scanResult: DriveScanResult,
  apiKey: string,
  model = 'gemini-2.5-flash'
): Promise<DriveScanResult> {
  const allLectures: DetectedLecture[] = [];
  scanResult.modules.forEach(m => allLectures.push(...m.lectures));

  if (allLectures.length === 0) return scanResult;

  const fileManifest = allLectures.map(l => ({
    id: l.id,
    originalFilename: l.title,
    sequenceGuess: l.sequenceNumber,
  }));

  const prompt = `You are a university curriculum organizer.
Given the following list of ${fileManifest.length} video lectures from a Google Drive folder for "${scanResult.courseName}":

${JSON.stringify(fileManifest, null, 2)}

Task:
1. Determine the subject domain.
2. Clean up cryptic or messy filenames into clear, professional lecture topic titles (e.g. "01_intro_v2.mp4" -> "Introduction to Distributed Systems").
3. Determine the optimal pedagogical order (Module 1, Module 2, Module 3, etc.).
4. Assign every single file ID from the input into an appropriate module.

Return strictly JSON with this exact schema:
{
  "courseTitle": "Polished Course Name",
  "modules": [
    {
      "name": "Module Name (e.g. Module 1: Foundations)",
      "order": 1,
      "lectureIds": ["file_id_1", "file_id_2"]
    }
  ],
  "cleanTitles": {
    "file_id_1": "Polished Topic Name"
  }
}`;

  try {
    const res = await generateStructuredCompletion({
      provider: 'gemini',
      apiKey,
      model,
      prompt,
      systemPrompt: 'Respond strictly with valid JSON. Organize the course into balanced modules with 3-6 lectures each.',
    });

    const parsed = typeof res === 'string' ? JSON.parse(res) : res;
    if (parsed.modules && Array.isArray(parsed.modules)) {
      const lectureById = new Map<string, DetectedLecture>(allLectures.map(l => [l.id, l]));

      const newModules: DetectedModule[] = [];
      let modOrder = 1;

      for (const m of parsed.modules) {
        const modLectures: DetectedLecture[] = [];
        if (m.lectureIds && Array.isArray(m.lectureIds)) {
          for (const fid of m.lectureIds) {
            const original = lectureById.get(fid);
            if (original) {
              const cleanTitle = parsed.cleanTitles?.[fid] || original.cleanName;
              modLectures.push({
                ...original,
                cleanName: cleanTitle,
              });
              lectureById.delete(fid);
            }
          }
        }
        if (modLectures.length > 0) {
          const modTopics: DetectedTopic[] = modLectures.map((lec, lIdx) => ({
            id: `ai-top-${lec.id}`,
            name: lec.cleanName,
            order: lIdx + 1,
            resources: [{
              id: lec.id,
              name: lec.title,
              cleanTitle: lec.cleanName,
              resourceType: 'video',
              mimeType: lec.mimeType,
              fileSize: lec.fileSize,
              driveUrl: lec.driveUrl,
            }],
            lectures: [lec],
          }));

          newModules.push({
            id: `ai-mod-${modOrder}`,
            name: m.name || `Module ${modOrder}`,
            order: modOrder++,
            topics: modTopics,
            moduleResources: [],
            lectures: modLectures,
          });
        }
      }

      return {
        ...scanResult,
        courseName: parsed.courseTitle || scanResult.courseName,
        modules: newModules,
      };
    }
  } catch (err) {
    console.warn('[AI Course Organizer] Failed to structure with Gemini, keeping deterministic layout:', err);
  }

  return scanResult;
}
