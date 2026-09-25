import { DriveFileItem, DetectedLecture, DetectedModule, DriveScanResult } from '@/types/video';
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

  // 3. Raw alphanumeric ID: typically 25 to 50 alphanumeric characters
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Natural Alphanumeric Comparison for sorting filenames like humans expect:
 * "Lecture 1", "Lecture 2", "Lecture 10" (instead of 1, 10, 2).
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Extracts a sequential number from a video filename (e.g. "01_Intro", "Lecture 04", "Part 2").
 */
export function extractSequenceNumber(filename: string): number {
  const clean = filename.toLowerCase();

  // Pattern A: Leading numbers like "01_...", "01 - ...", "01. ..."
  const leadingMatch = clean.match(/^0*(\d+)[_.\-\s]/);
  if (leadingMatch) return parseInt(leadingMatch[1], 10);

  // Pattern B: Keyword followed by number "lecture 03", "lec 3", "class 3", "session 3", "week 2"
  const keywordMatch = clean.match(/(?:lec(?:ture)?|class|session|part|module|week|w|p|c)[\s._\-#]*(\d+)/i);
  if (keywordMatch) return parseInt(keywordMatch[1], 10);

  // Pattern C: Trailing number before extension "Intro - 05.mp4"
  const trailingMatch = clean.match(/[\s._\-#](\d+)(?:\.[a-z0-9]+)?$/i);
  if (trailingMatch) return parseInt(trailingMatch[1], 10);

  // Pattern D: Any first standalone digits in filename
  const anyDigitsMatch = clean.match(/(\d+)/);
  if (anyDigitsMatch) return parseInt(anyDigitsMatch[1], 10);

  return 9999;
}

/**
 * Strips extensions and numbering prefixes to produce a human-friendly lecture title.
 */
export function cleanLectureTitle(filename: string): string {
  let name = filename.replace(/\.(mp4|mkv|webm|avi|mov|m4v|flv)$/i, '');

  // Strip leading prefixes like "01_", "01 - ", "Lecture 1 - ", "Lec 01: "
  name = name.replace(/^(\d+[\s._\-]+)+/, '');
  name = name.replace(/^(lecture|lec|class|session|part)[\s._\-#]*\d+[\s._\-:]*/i, '');

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

/**
 * Normalizes a base filename for pairing videos with slides (e.g. "01_arrays" from "01_arrays.mp4").
 */
function getBaseKey(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_](slides|notes|presentation|deck|handout|assignment)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];
const SLIDE_EXTENSIONS = ['.pdf'];

export function isVideoFile(file: DriveFileItem): boolean {
  if (file.mimeType && file.mimeType.startsWith('video/')) return true;
  const lower = file.name.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export function isSlideFile(file: DriveFileItem): boolean {
  if (file.mimeType === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Recursively queries Google Drive API v3 to list files in a folder and its subfolders.
 */
export async function fetchDriveFolderHierarchy(
  folderId: string,
  authConfig: { accessToken?: string; apiKey?: string }
): Promise<{ folderName: string; files: DriveFileItem[]; subfolders: { id: string; name: string }[] }> {
  const { accessToken, apiKey } = authConfig;
  const authHeader: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';

  // 1. Get Folder Info
  let folderName = 'Google Drive Course';
  try {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType${keyParam}`,
      { headers: authHeader }
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      if (meta.name) folderName = meta.name;
    }
  } catch (err) {
    console.warn('[Drive Scanner] Could not fetch folder metadata:', err);
  }

  // 2. Fetch all direct files and subfolders
  const allFiles: DriveFileItem[] = [];
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
      throw new Error(errData?.error?.message || `Google Drive API returned status ${res.status}`);
    }

    const data = await res.json();
    if (data.files && Array.isArray(data.files)) {
      for (const item of data.files) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          subfolders.push({ id: item.id, name: item.name });
        } else {
          allFiles.push(item);
        }
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  // 3. For any subfolders, fetch their files too (1 level deep of submodules)
  for (const sub of subfolders) {
    try {
      const subQuery = `'${sub.id}' in parents and trashed = false`;
      const subFields = 'files(id,name,mimeType,size,webViewLink,webContentLink,parents,createdTime,modifiedTime)';
      const subUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQuery)}&pageSize=100&fields=${encodeURIComponent(subFields)}${keyParam}`;
      const subRes = await fetch(subUrl, { headers: authHeader });
      if (subRes.ok) {
        const subData = await subRes.json();
        if (subData.files && Array.isArray(subData.files)) {
          for (const item of subData.files) {
            if (item.mimeType !== 'application/vnd.google-apps.folder') {
              allFiles.push(item);
            }
          }
        }
      }
    } catch (subErr) {
      console.warn(`[Drive Scanner] Could not scan subfolder '${sub.name}':`, subErr);
    }
  }

  return { folderName, files: allFiles, subfolders };
}

/**
 * Organizes scanned Drive files into Modules and Topics with natural sorting and PDF pairing.
 */
export function organizeDriveFiles(
  courseName: string,
  folderId: string,
  files: DriveFileItem[],
  subfolders: { id: string; name: string }[]
): DriveScanResult {
  const videoFiles = files.filter(isVideoFile);
  const slideFiles = files.filter(isSlideFile);

  // Build a slide lookup map by base key
  const slideMap = new Map<string, DriveFileItem>();
  for (const slide of slideFiles) {
    const key = getBaseKey(slide.name);
    slideMap.set(key, slide);
  }

  const modulesMap = new Map<string, { name: string; order: number; lectures: DetectedLecture[] }>();

  // If subfolders exist, use them as module containers
  const subfolderMap = new Map(subfolders.map((s, idx) => [s.id, { name: s.name, order: idx + 1 }]));

  let unassignedLectures: DetectedLecture[] = [];

  for (const vid of videoFiles) {
    const seq = extractSequenceNumber(vid.name);
    const cleanTitle = cleanLectureTitle(vid.name);
    const baseKey = getBaseKey(vid.name);
    const matchedSlide = slideMap.get(baseKey);

    const lecture: DetectedLecture = {
      id: vid.id,
      title: vid.name,
      cleanName: cleanTitle,
      sequenceNumber: seq,
      fileSize: vid.size ? Number(vid.size) : undefined,
      mimeType: vid.mimeType || 'video/mp4',
      driveUrl: vid.webViewLink || `https://drive.google.com/file/d/${vid.id}/view`,
      slidesFile: matchedSlide
    };

    // Check which parent folder this file belongs to
    const parentId = vid.parents?.[0];
    if (parentId && subfolderMap.has(parentId)) {
      const parentInfo = subfolderMap.get(parentId)!;
      if (!modulesMap.has(parentId)) {
        modulesMap.set(parentId, { name: parentInfo.name, order: parentInfo.order, lectures: [] });
      }
      modulesMap.get(parentId)!.lectures.push(lecture);
    } else {
      unassignedLectures.push(lecture);
    }
  }

  // Sort lectures within each subfolder module naturally
  const modules: DetectedModule[] = [];
  modulesMap.forEach((val, id) => {
    val.lectures.sort((a, b) => {
      if (a.sequenceNumber !== b.sequenceNumber) return a.sequenceNumber - b.sequenceNumber;
      return naturalCompare(a.title, b.title);
    });
    modules.push({
      id,
      name: val.name,
      order: val.order,
      lectures: val.lectures
    });
  });

  // If there are unassigned lectures (or flat folder structure without subfolders):
  if (unassignedLectures.length > 0) {
    unassignedLectures.sort((a, b) => {
      if (a.sequenceNumber !== b.sequenceNumber) return a.sequenceNumber - b.sequenceNumber;
      return naturalCompare(a.title, b.title);
    });

    if (modules.length === 0) {
      // Completely flat folder: split into chunks of 5-8 lectures per module
      const CHUNK_SIZE = 6;
      for (let i = 0; i < unassignedLectures.length; i += CHUNK_SIZE) {
        const chunk = unassignedLectures.slice(i, i + CHUNK_SIZE);
        const moduleIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const startLec = chunk[0].sequenceNumber !== 9999 ? chunk[0].sequenceNumber : i + 1;
        const endLec = chunk[chunk.length - 1].sequenceNumber !== 9999 ? chunk[chunk.length - 1].sequenceNumber : i + chunk.length;
        
        modules.push({
          id: `mod-flat-${moduleIndex}`,
          name: `Module ${moduleIndex}: Lectures ${startLec}–${endLec}`,
          order: moduleIndex,
          lectures: chunk
        });
      }
    } else {
      // Append leftover lectures to a "General Lectures" module
      modules.push({
        id: 'mod-general',
        name: 'General Course Lectures',
        order: modules.length + 1,
        lectures: unassignedLectures
      });
    }
  }

  // Sort modules by order
  modules.sort((a, b) => a.order - b.order);

  return {
    courseName,
    folderId,
    totalLectures: videoFiles.length,
    totalSlides: slideFiles.length,
    modules,
    rawFilesCount: files.length
  };
}

/**
 * AI-Assisted Course Organizer:
 * Uses Gemini BYOK to organize messy lecture titles into a beautiful pedagogical structure.
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
    sequenceGuess: l.sequenceNumber
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
      systemPrompt: 'Respond strictly with valid JSON. Organize the course into balanced modules with 3-6 lectures each.'
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
                cleanName: cleanTitle
              });
              lectureById.delete(fid);
            }
          }
        }
        if (modLectures.length > 0) {
          newModules.push({
            id: `ai-mod-${modOrder}`,
            name: m.name || `Module ${modOrder}`,
            order: modOrder++,
            lectures: modLectures
          });
        }
      }

      // Add any leftover lectures that weren't assigned
      if (lectureById.size > 0) {
        newModules.push({
          id: `ai-mod-extra`,
          name: 'Additional Lectures',
          order: modOrder,
          lectures: Array.from(lectureById.values())
        });
      }

      return {
        ...scanResult,
        courseName: parsed.courseTitle || scanResult.courseName,
        modules: newModules
      };
    }
  } catch (err) {
    console.warn('[AI Course Organizer] Failed to structure with Gemini, using heuristic layout:', err);
  }

  return scanResult;
}
