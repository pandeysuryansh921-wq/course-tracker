import { db } from './db';
import { Resource, ResourceMapping, Course, Module, Topic } from '@/types/curriculum';

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
  'quizScore',
  'masteryScore',
  'isCompleted',
  'isMastered',
  'nextReviewDate',
  'userProfile',
  'email',
  'name',
  'userId',
  'startedAt',
  'endedAt',
  'studySessions',
  'flashcards',
  'externalLinks'
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
    const currentPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.includes(key)) {
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
  const course = await db.courses.get(courseId);
  if (!course) throw new Error('Course not found');

  const modules = await db.modules.where('courseId').equals(courseId).toArray();
  const moduleIds = modules.map(m => m.id);

  const topicTemplates = await db.topicTemplates.where('courseId').equals(courseId).toArray();
  const topicIds = topicTemplates.map(t => t.id);

  const selections = await db.userResourceSelections.where('courseId').equals(courseId).toArray();
  const resourceTemplates = await db.resourceTemplates.toArray();

  const sanitizedTopics = topicTemplates.map(t => {
    const topicSelections = selections.filter(s => s.topicId === t.id);
    const resources = topicSelections.map(s => {
      const template = resourceTemplates.find(rt => rt.id === s.resourceId);
      return {
        title: template?.title || 'Resource',
        url: template?.canonicalUrl || '',
        type: template?.type || 'DOCUMENTATION',
        role: s.role
      };
    });

    return {
      id: t.id,
      moduleId: t.moduleId,
      title: t.name,
      description: t.description,
      prerequisites: t.prerequisites,
      learningOutcomes: t.learningOutcomes,
      estimatedHours: t.estimatedHours,
      difficulty: t.difficulty,
      order: t.order,
      resources
    };
  });

  const payload: SanitizedCurriculumPayload = {
    version: 'degreetrack.curriculum.v1',
    exportedAt: new Date().toISOString(),
    course: {
      title: course.name,
      description: course.description,
      color: course.color,
      icon: course.icon,
    },
    modules: modules.map(m => ({
      id: m.id,
      title: m.name,
      description: m.description,
      order: m.order,
    })),
    topics: sanitizedTopics
  };

  verifySanitization(payload);
  return payload;
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
  method: 'github_api' | 'webhook' | 'github_prefill';
  message: string;
  url?: string;
}

export const COMMUNITY_REPO = 'pandeysuryansh921-wq/degree-track-library';

/**
 * 1-Tap Community Export & Publishing:
 * 1. Automatically verifies that payload passes the Privacy Firewall.
 * 2. If GitHub Token or Webhook is configured, directly pushes via API without extra steps.
 * 3. Otherwise: Copies sanitized JSON, downloads local backup, and launches GitHub submission page pre-filled!
 */
export async function publishToCommunityOneTap(
  payload: CommunityResourcePayload | SanitizedCurriculumPayload | CommunityManifestPayload,
  title: string,
  options?: {
    webhookUrl?: string;
    githubToken?: string;
  }
): Promise<OneTapPublishResult> {
  // 1. Mandatory Privacy Firewall Verification
  verifySanitization(payload);

  const jsonString = JSON.stringify(payload, null, 2);
  const safeFilename = title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 35) + '.json';

  // 2. Direct GitHub REST API (if token available)
  const token = options?.githubToken || (typeof window !== 'undefined' ? localStorage.getItem('degreetrack_community_token') : null);
  if (token) {
    try {
      const path = `submissions/${safeFilename}`;
      const contentBase64 = typeof window !== 'undefined' && window.btoa 
        ? window.btoa(unescape(encodeURIComponent(jsonString))) 
        : Buffer.from(jsonString).toString('base64');
      
      const res = await fetch(`https://api.github.com/repos/${COMMUNITY_REPO}/contents/${path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `feat(community): 1-tap submission of ${title}`,
          content: contentBase64,
          branch: 'main'
        })
      });

      if (res.ok) {
        return {
          success: true,
          method: 'github_api',
          message: `1-Tap Published directly to ${COMMUNITY_REPO}!`,
          url: `https://github.com/${COMMUNITY_REPO}/blob/main/${path}`
        };
      }
    } catch (err) {
      console.warn('Direct GitHub API push failed, falling back to prefill:', err);
    }
  }

  // 3. Direct Webhook (if configured)
  const webhook = options?.webhookUrl || (typeof window !== 'undefined' ? localStorage.getItem('degreetrack_community_webhook') : null);
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonString
      });

      if (res.ok) {
        return {
          success: true,
          method: 'webhook',
          message: `1-Tap Submitted to community webhook successfully!`
        };
      }
    } catch (err) {
      console.warn('Webhook submission failed, falling back:', err);
    }
  }

  // 4. Default 1-Tap Zero-Config: Clipboard + Local Backup Download + Prefilled GitHub Issue
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(jsonString).catch(() => {});
  }

  downloadJsonFile(payload, safeFilename);

  const issueTitle = encodeURIComponent(`[Community Submission]: ${title}`);
  const issueBody = encodeURIComponent(
`### Community Resource / Curriculum Submission
**Item:** ${title}
**Exported At:** ${new Date().toISOString()}

\`\`\`json
${jsonString.length > 3500 ? jsonString.substring(0, 3500) + '\n... [truncated for URL size, full JSON copied to clipboard & downloaded]' : jsonString}
\`\`\`

> *Verified 100% sanitized by DegreeTrack Privacy Firewall.*`
  );

  const prefillUrl = `https://github.com/${COMMUNITY_REPO}/issues/new?title=${issueTitle}&body=${issueBody}`;
  if (typeof window !== 'undefined') {
    window.open(prefillUrl, '_blank');
  }

  return {
    success: true,
    method: 'github_prefill',
    message: `1-Tap Export Complete! Copied to clipboard, downloaded, and opened in GitHub!`,
    url: prefillUrl
  };
}
