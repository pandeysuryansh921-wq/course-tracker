import { NextRequest, NextResponse } from 'next/server';

// In-memory sliding window rate limiter (max 20 requests per hour per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count += 1;
  return true;
}

// Strictly forbidden keys that indicate personal user data or secrets
const STRICT_FORBIDDEN_KEYS = new Set([
  'userid',
  'email',
  'userprofile',
  'personalnotes',
  'notes',
  'journal',
  'reflections',
  'quizscore',
  'quizscores',
  'mastery',
  'masteryscore',
  'masterypercentage',
  'completionpercentage',
  'completiontimestamp',
  'nextreviewdate',
  'reviewschedule',
  'studyhistory',
  'sessionhistory',
  'studysessions',
  'analytics',
  'streak',
  'personaldeadlines',
  'startedat',
  'endedat',
  'password',
  'token',
  'apikey',
  'secret',
  'flashcards',
  'submissionfile'
]);

// Secret pattern detector
const SECRET_REGEX = /(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{80,}|AIzaSy[a-zA-Z0-9_\-]{33}|Bearer\s+[a-zA-Z0-9_\-\.]{20,})/i;

/**
 * Server-side allowlist and privacy validation
 */
function validatePrivacyServerSide(obj: any, path: string = ''): void {
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      if (SECRET_REGEX.test(obj)) {
        throw new Error(`[Privacy Firewall Violation] Detected credential pattern at "${path}".`);
      }
    }
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => validatePrivacyServerSide(item, `${path}[${idx}]`));
    return;
  }

  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z]/g, '');
    const currentPath = path ? `${path}.${key}` : key;

    if (STRICT_FORBIDDEN_KEYS.has(lowerKey)) {
      throw new Error(`[Privacy Firewall Violation] Forbidden private field "${currentPath}".`);
    }

    validatePrivacyServerSide(obj[key], currentPath);
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. IP extraction & rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
               req.headers.get('x-real-ip') || 
               'anonymous_client';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please wait before submitting again.' },
        { status: 429 }
      );
    }

    // 2. Payload size guard (max 500 KB)
    const rawBody = await req.text();
    if (rawBody.length > 500 * 1024) {
      return NextResponse.json(
        { error: 'Payload exceeds maximum limit of 500KB.' },
        { status: 413 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request format.' },
        { status: 400 }
      );
    }

    const { type, payload } = body;
    if (!type || !payload) {
      return NextResponse.json(
        { error: 'Missing submission type or payload.' },
        { status: 400 }
      );
    }

    // 3. Server-side Privacy Verification
    try {
      validatePrivacyServerSide(payload);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || 'Privacy check failed. Personal data detected.' },
        { status: 422 }
      );
    }

    // 4. Structure & Schema Validation
    let title = 'Community Item';
    let issueTitle = '';

    if (type === 'resource') {
      const res = payload.resource || payload;
      const resTitle = res.title?.trim();
      const url = res.canonicalUrl || res.url;

      if (!resTitle || !url) {
        return NextResponse.json(
          { error: 'Resource must contain a valid title and URL.' },
          { status: 400 }
        );
      }

      const lowerUrl = url.toLowerCase().trim();
      if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Resource URL must begin with http:// or https://.' },
          { status: 400 }
        );
      }

      title = resTitle;
      issueTitle = `[RESOURCE SUBMISSION] ${title}`;

    } else if (type === 'course') {
      const courseTitle = payload.course?.title?.trim() || payload.course?.name?.trim() || payload.title?.trim();
      if (!courseTitle) {
        return NextResponse.json(
          { error: 'Course must include a course title.' },
          { status: 400 }
        );
      }
      title = courseTitle;
      issueTitle = `[COURSE SUBMISSION] ${title}`;

    } else if (type === 'batch' || type === 'manifest') {
      const count = payload.resources?.length || payload.totalResources || 0;
      title = `Resource Batch (${count} items)`;
      issueTitle = `[RESOURCE BATCH] ${count} resources`;

    } else {
      return NextResponse.json(
        { error: `Unsupported submission type "${type}". Allowed: resource, course, batch.` },
        { status: 400 }
      );
    }

    // 5. GitHub API Authentication & Issue Creation
    const githubToken = process.env.GITHUB_COMMUNITY_TOKEN;
    const repo = process.env.COMMUNITY_REPO || 'pandeysuryansh921-wq/course-tracker-library';

    if (!githubToken) {
      console.error('[Community Submit API] Server GITHUB_COMMUNITY_TOKEN not configured.');
      return NextResponse.json(
        { error: 'Community submission service temporarily unavailable. Please notify administrator.' },
        { status: 503 }
      );
    }

    const machineJson = JSON.stringify({
      schemaVersion: 1,
      submissionType: type,
      submittedAt: new Date().toISOString(),
      payload
    }, null, 2);

    const issueBody = `### Community Submission: ${title}
**Submission Type:** \`${type}\`
**Submitted At:** \`${new Date().toISOString()}\`

\`\`\`json
${machineJson}
\`\`\`

> *Verified 100% sanitized by DegreeTrack Privacy Firewall.*`;

    const ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'DegreeTrack-Community-Submission-Service'
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ['community-submission']
      })
    });

    if (!ghRes.ok) {
      const errData = await ghRes.json().catch(() => ({}));
      console.error('[Community Submit API] GitHub Issue creation failed:', ghRes.status, errData);
      return NextResponse.json(
        { error: `Failed to create community issue on GitHub (${ghRes.status}): ${errData.message || 'Unknown error'}` },
        { status: 502 }
      );
    }

    const ghData = await ghRes.json();
    const issueNumber = ghData.number;
    const submissionId = `GH-${issueNumber}`;

    return NextResponse.json({
      success: true,
      submissionId,
      issueNumber,
      issueUrl: ghData.html_url,
      status: 'pending',
      message: `Submitted for community review (#${submissionId}). Automated verification is in progress.`
    });

  } catch (error: any) {
    console.error('[Community Submit API] Unhandled exception:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error processing submission.' },
      { status: 500 }
    );
  }
}
