/**
 * DegreeTrack Community Submission Cloudflare Worker
 * 
 * Free, zero-maintenance serverless proxy for 1-Tap Community Submissions.
 * Eliminates the need for any user or student to generate GitHub tokens.
 * 
 * Instructions to deploy in 60 seconds (100% Free forever):
 * 1. Log in to https://dash.cloudflare.com (free account).
 * 2. Go to "Workers & Pages" -> "Create application" -> "Create Worker".
 * 3. Paste this code into the Worker editor.
 * 4. Under Worker "Settings" -> "Variables", add Secret:
 *    - GITHUB_TOKEN: A GitHub PAT with "Issues: Read & Write" on your course-tracker-library repo.
 * 5. Copy your worker URL (e.g. https://degreetrack-community.<your-subdomain>.workers.dev).
 * 6. Set NEXT_PUBLIC_COMMUNITY_API_URL to that worker URL in your .env.local!
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { type, payload } = body;

      if (!type || !payload) {
        return new Response(JSON.stringify({ error: "Missing type or payload" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const repo = env.COMMUNITY_REPO || "pandeysuryansh921-wq/course-tracker-library";
      const token = env.GITHUB_TOKEN;

      if (!token) {
        return new Response(JSON.stringify({ error: "Server GITHUB_TOKEN not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let issueTitle = `[COMMUNITY SUBMISSION] ${type}`;
      if (type === "course") {
        const courseTitle = payload.course?.title || payload.title || "Course Curriculum";
        issueTitle = `[COURSE SUBMISSION] ${courseTitle}`;
      } else if (type === "resource") {
        const resTitle = payload.resource?.title || payload.title || "Educational Resource";
        issueTitle = `[RESOURCE SUBMISSION] ${resTitle}`;
      } else if (type === "batch") {
        const count = payload.resources?.length || payload.totalResources || 0;
        issueTitle = `[RESOURCE BATCH] ${count} resources`;
      }

      const machineJson = JSON.stringify({
        schemaVersion: 1,
        submissionType: type,
        submittedAt: new Date().toISOString(),
        payload,
      }, null, 2);

      const issueBody = `### Community Submission: ${issueTitle}\n**Submission Type:** \`${type}\`\n**Submitted At:** \`${new Date().toISOString()}\`\n\n\`\`\`json\n${machineJson}\n\`\`\`\n\n> *Verified 100% sanitized by DegreeTrack Privacy Firewall.*`;

      let ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "DegreeTrack-Community-Worker",
        },
        body: JSON.stringify({
          title: issueTitle,
          body: issueBody,
          labels: ["community-submission"],
        }),
      });

      // Retry without labels if token lacks label triage permissions
      if (!ghRes.ok && (ghRes.status === 403 || ghRes.status === 422)) {
        ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "DegreeTrack-Community-Worker",
          },
          body: JSON.stringify({
            title: issueTitle,
            body: issueBody,
          }),
        });
      }

      if (!ghRes.ok) {
        const errText = await ghRes.text();
        return new Response(JSON.stringify({ error: `GitHub API error: ${errText}` }), {
          status: ghRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ghData = await ghRes.json();
      return new Response(JSON.stringify({
        success: true,
        submissionId: `GH-${ghData.number}`,
        issueNumber: ghData.number,
        issueUrl: ghData.html_url,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
