import { db } from './db';
import { Resource, ResourceMapping, Course, Module, Topic } from '@/types/curriculum';
import { useCurriculumStore } from '@/stores/useCurriculumStore';

export interface CommunityResourcePayload {
  version: 'degreetrack.community.v1';
  exportedAt: string;
  resource: {
    canonicalUrl: string;
    title: string;
    type: string;
    role?: string;
    description?: string;
    estimatedHours?: number;
    freeStatus?: string;
  };
  metrics: {
    confidenceScore: number;
    successCount: number;
    usageCount: number;
    effectivenessLevel: 'high' | 'moderate' | 'emerging';
  };
  context: {
    topics: string[];
    concepts: string[];
  };
}

export interface CommunityManifestPayload {
  version: 'degreetrack.community.v1';
  exportedAt: string;
  source: 'DegreeTrack Local';
  totalResources: number;
  resources: CommunityResourcePayload[];
}

export interface SanitizedCurriculumPayload {
  version: 'degreetrack.curriculum.v1';
  exportedAt: string;
  course: {
    title: string;
    description?: string;
    color?: string;
    icon?: string;
  };
  modules: {
    id: string;
    title: string;
    description?: string;
    order?: number;
  }[];
  topics: {
    id: string;
    moduleId: string;
    title: string;
    description?: string;
    prerequisites?: string[];
    learningOutcomes?: string[];
    estimatedHours?: number;
    difficulty?: string;
    order?: number;
    resources: {
      title: string;
      url: string;
      type: string;
      role?: string;
    }[];
  }[];
}

// Forbidden fields that MUST NEVER be exported to the community
const FORBIDDEN_KEYS = [
  'notes',
  'personalnotes',
  'quizscore',
  'quizscores',
  'masteryscore',
  'masterypercentage',
  'iscompleted',
  'ismastered',
  'nextreviewdate',
  'userprofile',
  'email',
  'userid',
  'startedat',
  'endedat',
  'studysessions',
  'flashcards',
  'submissionfile'
];

/**
 * Strict privacy assertion: recursively scans any payload to guarantee zero private user state leaks.
 */
export function verifySanitization(obj: any, path: string = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => verifySanitization(item, `${path}[${idx}]`));
    return;
  }

  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z]/g, '');
    const currentPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.includes(lowerKey)) {
      throw new Error(`[Privacy Firewall Violation] Forbidden private key detected: "${currentPath}". Export aborted.`);
    }
    verifySanitization(obj[key], currentPath);
  }
}

/**
 * Sanitizes a single resource and its confidence metrics for community sharing.
 */
export async function sanitizeResourceForCommunity(
  resource: Resource,
  mapping?: ResourceMapping,
  relatedTopics: string[] = [],
  relatedConcepts: string[] = []
): Promise<CommunityResourcePayload> {
  const confidence = mapping?.confidenceScore || 0;
  const successCount = mapping?.successCount || 0;
  const usageCount = mapping?.usageCount || 0;

  let effectivenessLevel: 'high' | 'moderate' | 'emerging' = 'emerging';
  if (confidence >= 15) {
    effectivenessLevel = 'high';
  } else if (confidence >= 5) {
    effectivenessLevel = 'moderate';
  }

  const payload: CommunityResourcePayload = {
    version: 'degreetrack.community.v1',
    exportedAt: new Date().toISOString(),
    resource: {
      canonicalUrl: resource.canonicalUrl || resource.url,
      title: resource.title,
      type: resource.type || 'DOCUMENTATION',
      role: resource.scopeInstructions,
      description: resource.description,
      estimatedHours: resource.estimatedHours,
      freeStatus: resource.freeStatus,
    },
    metrics: {
      confidenceScore: confidence,
      successCount,
      usageCount,
      effectivenessLevel,
    },
    context: {
      topics: Array.from(new Set(relatedTopics)),
      concepts: Array.from(new Set(relatedConcepts)),
    }
  };

  // Run privacy firewall check
  verifySanitization(payload);

  return payload;
}

/**
 * Packages all unique resources into a sanitized community manifest.
 */
export async function generateCommunityResourceManifest(): Promise<CommunityManifestPayload> {
  const templates = await db.resourceTemplates.toArray();
  const mappings = await db.resourceMappings.toArray();
  const topicTemplates = await db.topicTemplates.toArray();
  const selections = await db.userResourceSelections.toArray();

  const payloadList: CommunityResourcePayload[] = [];

  for (const t of templates) {
    const relatedSelections = selections.filter(s => s.resourceId === t.id);
    const relatedTopicIds = relatedSelections.map(s => s.topicId).filter(Boolean);
    const relatedTopics = topicTemplates
      .filter(tt => relatedTopicIds.includes(tt.id))
      .map(tt => tt.name);

    const mapping = mappings.find(m => m.resourceId === t.id);

    const sanitized = await sanitizeResourceForCommunity(
      {
        ...t,
        url: t.canonicalUrl,
        scopeInstructions: relatedSelections[0]?.role
      } as Resource,
      mapping,
      relatedTopics
    );

    payloadList.push(sanitized);
  }

  const manifest: CommunityManifestPayload = {
    version: 'degreetrack.community.v1',
    exportedAt: new Date().toISOString(),
    source: 'DegreeTrack Local',
    totalResources: payloadList.length,
    resources: payloadList
  };

  verifySanitization(manifest);
  return manifest;
}

/**
 * Sanitizes a course curriculum for community sharing (removes all personal progress).
 */
export async function sanitizeCourseCurriculum(courseId: string): Promise<SanitizedCurriculumPayload> {
  const store = useCurriculumStore.getState();
  const course = store.courses.find(c => c.id === courseId) || await db.courses.get(courseId);
  if (!course) throw new Error(`Course not found (ID: ${courseId})`);

  let modules = store.modules.filter(m => m.courseId === courseId);
  if (modules.length === 0) {
    modules = await db.modules.where('courseId').equals(courseId).toArray();
  }
  const moduleIds = new Set(modules.map(m => m.id));

  // Find topics by courseId or by matching moduleIds, checking store, topicTemplates, and legacy topics table
  let topics = store.topics.filter(t => t.courseId === courseId || (t.moduleId && moduleIds.has(t.moduleId)));
  if (topics.length === 0) {
    const templates = await db.topicTemplates.toArray().catch(() => []) || [];
    topics = templates.filter((t: any) => t.courseId === courseId || (t.moduleId && moduleIds.has(t.moduleId))) as any;
    if (topics.length === 0) {
      const legacyTopics = await (db as any).topics?.toArray().catch(() => []) || [];
      topics = legacyTopics.filter((t: any) => t.courseId === courseId || (t.moduleId && moduleIds.has(t.moduleId)));
    }
  }
  const topicIds = new Set(topics.map(t => t.id));

  // Find resources belonging to these topics
  const storeResources = store.resources.filter(r => r.topicId && topicIds.has(r.topicId));
  const resourceTemplates = await db.resourceTemplates.toArray().catch(() => []) || [];
  const userSelections = await db.userResourceSelections.toArray().catch(() => []) || [];
  const legacyResources = await (db as any).resources?.toArray().catch(() => []) || [];

  const sanitizedTopics = topics.map(t => {
    const fromStore = storeResources.filter(r => r.topicId === t.id);
    const fromSelections = userSelections
      .filter(s => s.topicId === t.id)
      .map(s => {
        const tmpl = resourceTemplates.find(rt => rt.id === s.resourceId);
        return tmpl ? { ...tmpl, role: s.role, url: tmpl.canonicalUrl } : null;
      })
      .filter(Boolean);
    const fromLegacy = legacyResources.filter((r: any) => r.topicId === t.id);

    const seenUrls = new Set<string>();
    const mergedResources: any[] = [];

    for (const r of [...fromStore, ...fromSelections, ...fromLegacy]) {
      const rawUrl = (r as any).canonicalUrl || (r as any).url;
      if (!rawUrl) continue;
      const cleanUrl = rawUrl.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) continue;
      if (seenUrls.has(cleanUrl.toLowerCase())) continue;
      seenUrls.add(cleanUrl.toLowerCase());

      mergedResources.push({
        title: (r as any).title || 'Educational Resource',
        url: cleanUrl,
        type: ((r as any).type?.toLowerCase() || 'article'),
        role: (r as any).scopeInstructions || (r as any).role || 'PRIMARY'
      });
    }

    return {
      id: t.id,
      moduleId: t.moduleId,
      title: t.name || (t as any).title || 'Topic',
      description: t.description || '',
      prerequisites: Array.isArray(t.prerequisites) ? t.prerequisites : (t.prerequisites ? [t.prerequisites] : []),
      learningOutcomes: Array.isArray(t.learningOutcomes) ? t.learningOutcomes : (t.learningOutcomes ? [t.learningOutcomes] : []),
      estimatedHours: typeof t.estimatedHours === 'number' ? t.estimatedHours : 2,
      difficulty: t.difficulty || 'intermediate',
      order: typeof t.order === 'number' ? t.order : 0,
      resources: mergedResources
    };
  });

  const payload: SanitizedCurriculumPayload = {
    version: 'degreetrack.curriculum.v1',
    exportedAt: new Date().toISOString(),
    course: {
      title: course.name || (course as any).title || 'Curriculum',
      description: course.description || 'Community course curriculum.',
      color: course.color || '#3B82F6',
      icon: course.icon || 'Book',
    },
    modules: modules.map(m => ({
      id: m.id,
      title: m.name || (m as any).title || 'Module',
      description: m.description || '',
      order: typeof m.order === 'number' ? m.order : 0,
    })),
    topics: sanitizedTopics
  };

  verifySanitization(payload);
  return payload;
}

/**
 * Sanitizes all courses in the active curriculum as an entire degree collection.
 */
export async function sanitizeEntireDegree(): Promise<SanitizedCurriculumPayload[]> {
  const store = useCurriculumStore.getState();
  const allCourses = store.courses.length > 0 ? store.courses : await db.courses.toArray();
  if (allCourses.length === 0) throw new Error('No courses found to export');

  const sanitized = await Promise.all(
    allCourses.map(c => sanitizeCourseCurriculum(c.id))
  );

  return sanitized;
}

/**
 * Triggers a browser download of any sanitized JSON object.
 */
export function downloadJsonFile(data: any, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface OneTapPublishResult {
  success: boolean;
  method: 'serverless_api' | 'webhook' | 'local_backup';
  message: string;
  submissionId?: string;
  issueNumber?: number;
  url?: string;
}

export const COMMUNITY_REPO = 'pandeysuryansh921-wq/course-tracker-library';

/**
 * 1-Tap Community Export & Publishing:
 * 1. Automatically verifies that payload passes the Client Privacy Firewall.
 * 2. Directly submits to the serverless /api/community/submit endpoint.
 * 3. Returns immediate confirmation with submission ID (#GH-xxx).
 * 4. Zero popups, zero clipboard, zero GitHub account required from contributor.
 */
export async function publishToCommunityOneTap(
  payload: CommunityResourcePayload | SanitizedCurriculumPayload | CommunityManifestPayload,
  title: string
): Promise<OneTapPublishResult> {
  // 1. Mandatory Client-side Privacy Firewall Verification
  verifySanitization(payload);

  let type: 'course' | 'resource' | 'batch' = 'resource';
  if ((payload as any).course) {
    type = 'course';
  } else if ((payload as any).resources && Array.isArray((payload as any).resources)) {
    type = 'batch';
  }

  // 2. Call Serverless Community Submission Endpoint
  try {
    const endpoint = process.env.NEXT_PUBLIC_COMMUNITY_API_URL || '/api/community/submit';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        type,
        payload
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Server error (${res.status})`);
    }

    return {
      success: true,
      method: 'serverless_api',
      submissionId: data.submissionId,
      issueNumber: data.issueNumber,
      message: `✓ Submitted for community review (${data.submissionId || 'Pending'})! Automated verification is in progress.`,
      url: data.issueUrl
    };
  } catch (err: any) {
    // Save local backup file if offline/server unreachable so contributor work is never lost
    const safeFilename = `backup_${title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30)}.json`;
    downloadJsonFile(payload, safeFilename);

    throw new Error(
      `Community submission service error: ${err.message}. A local backup (${safeFilename}) was saved to your device.`
    );
  }
}
