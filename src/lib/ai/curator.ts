import { CurateCourseRequest, CuratedCourseResponse, AIKeyConfig } from '@/types/ai';
import { generateStructuredCompletion } from './client';
import { searchTavily, searchYouTube } from './discovery';
import { COURSE_COLORS, COURSE_ICONS, generateId, generateUri } from '@/lib/utils';
import { db } from '@/lib/db';
import { useCurriculumStore } from '@/stores/useCurriculumStore';

const CURATOR_SYSTEM_PROMPT = `You are a master curriculum architect and university department head specializing in self-directed learning, computer science, medicine, engineering, and interdisciplinary fields.
Your mission is to construct rigorous, practical, and highly motivating course curricula tailored to the student's background and goals.

Follow these pedagogical rules strictly:
1. Break down the overarching topic into 3 to 6 logical sequential modules.
2. Under each module, create 2 to 4 concrete, actionable topics.
3. For each topic:
   - Provide clear, testable learning objectives (2-3 items).
   - Set realistic estimated study hours (typically 2 to 8 hours per topic).
   - Assign appropriate difficulty ("BEGINNER", "INTERMEDIATE", "ADVANCED").
   - List key skills acquired.
   - Recommend 2-3 genuine, top-tier educational resources (official documentation, reputable video channels, academic tutorials, or interactive guides) with realistic URLs.
4. Select a matching color from: [${COURSE_COLORS.join(', ')}].
5. Select a matching icon name from: [${COURSE_ICONS.join(', ')}].
6. You must output strictly valid JSON matching the specified JSON schema without any surrounding markdown commentary.`;

export async function curateCourseWithAI(
  req: CurateCourseRequest,
  keys: AIKeyConfig
): Promise<CuratedCourseResponse> {
  const provider = req.provider || 'gemini';
  const apiKey = (keys as any)[provider];

  if (!apiKey || !apiKey.trim()) {
    throw new Error(`No API key configured for ${provider.toUpperCase()}. Please configure your key in Settings or in the curation prompt.`);
  }

  const model = req.model || (provider === 'gemini' ? 'gemini-2.0-flash' : provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'openai' ? 'gpt-4o' : 'claude-3-7-sonnet-latest');

  const durationContext = req.durationWeeks 
    ? `Designed for a ${req.durationWeeks}-week timeframe with approximately ${req.hoursPerWeek || 10} hours of study per week.` 
    : 'Designed for self-paced mastery.';

  const focusContext = {
    'comprehensive': 'Balanced blend of theoretical depth, foundational concepts, and hands-on practice.',
    'project-first': 'Applied, build-from-scratch focus where every module culminates in runnable code and portfolio projects.',
    'fast-track': 'High-yield, intensive crash course prioritizing the most critical 20% of concepts that yield 80% of results.',
    'interview-prep': 'Focused on technical interview problem-solving, system design trade-offs, and core fundamentals.'
  }[req.focus] || 'Comprehensive foundational and applied study.';

  const userPrompt = `Construct a complete course curriculum for:
Course Topic / Goal: "${req.topicPrompt}"
Target Level: ${req.level.toUpperCase()}
Pedagogical Focus: ${focusContext}
Pace: ${durationContext}
${req.prerequisites ? `Learner Prerequisites: ${req.prerequisites}` : ''}
${req.targetOutcomes ? `Desired Outcomes: ${req.targetOutcomes}` : ''}
${req.customInstructions ? `Special Instructions: ${req.customInstructions}` : ''}

Respond with a JSON object matching this exact structure:
{
  "title": "String (e.g. Advanced Distributed Systems in Go)",
  "code": "String (e.g. CS-402)",
  "description": "String (engaging 2-3 sentence overview of what the course covers and why it matters)",
  "color": "String (one of: ${COURSE_COLORS.slice(0, 6).join(', ')})",
  "icon": "String (one of: ${COURSE_ICONS.slice(0, 8).join(', ')})",
  "level": "${req.level}",
  "estimatedHours": Number (total estimated hours across all topics),
  "prerequisites": ["String", "String"],
  "learningOutcomes": ["String", "String", "String"],
  "modules": [
    {
      "name": "String (Module Name)",
      "description": "String (Short module scope)",
      "order": 0,
      "topics": [
        {
          "name": "String (Topic Title)",
          "description": "String (Detailed focus)",
          "estimatedHours": Number,
          "difficulty": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
          "learningObjectives": ["Objective 1", "Objective 2"],
          "skills": ["Skill 1", "Skill 2"],
          "resources": [
            {
              "title": "String (Resource Name)",
              "url": "String (Official URL or search link)",
              "type": "documentation" | "video" | "article" | "course",
              "role": "PRIMARY" | "REFERENCE" | "PRACTICE",
              "description": "Why this resource is recommended"
            }
          ]
        }
      ]
    }
  ]
}`;

  const generated = await generateStructuredCompletion<CuratedCourseResponse>({
    provider,
    apiKey,
    model,
    prompt: userPrompt,
    systemPrompt: CURATOR_SYSTEM_PROMPT,
    temperature: 0.4
  });

  // Validate and sanitize the output
  if (!generated || !generated.title || !Array.isArray(generated.modules)) {
    throw new Error('Curator received an invalid curriculum schema from the AI provider.');
  }

  // Ensure color & icon fallbacks
  if (!COURSE_COLORS.includes(generated.color)) {
    generated.color = 'blue';
  }
  if (!COURSE_ICONS.includes(generated.icon)) {
    generated.icon = 'Book';
  }

  // Normalize hours if missing
  let totalHours = 0;
  generated.modules.forEach((mod, mIdx) => {
    mod.order = mIdx;
    if (!Array.isArray(mod.topics)) mod.topics = [];
    
    mod.topics.forEach((topic) => {
      if (!topic.estimatedHours || topic.estimatedHours <= 0) {
        topic.estimatedHours = 3;
      }
      totalHours += topic.estimatedHours;
      if (!Array.isArray(topic.resources)) topic.resources = [];
      if (!Array.isArray(topic.learningObjectives)) topic.learningObjectives = [];
      if (!Array.isArray(topic.skills)) topic.skills = [];
    });
  });

  if (!generated.estimatedHours || generated.estimatedHours <= 0) {
    generated.estimatedHours = totalHours || 40;
  }

  // Optional: If Tavily or YouTube keys are provided, enrich first 2 topics with real search results
  if (req.enableWebSearch && (keys.tavily || keys.youtube)) {
    try {
      for (const mod of generated.modules.slice(0, 2)) {
        for (const topic of mod.topics.slice(0, 2)) {
          if (keys.tavily) {
            const webResults = await searchTavily(`${generated.title} ${topic.name}`, keys.tavily);
            for (const item of webResults.slice(0, 1)) {
              if (!topic.resources.some(r => r.url === item.url)) {
                topic.resources.push({
                  title: item.title,
                  url: item.url,
                  type: 'documentation',
                  role: 'REFERENCE',
                  description: item.description
                });
              }
            }
          }
          if (keys.youtube) {
            const ytResults = await searchYouTube(`${topic.name} tutorial`, keys.youtube);
            for (const item of ytResults.slice(0, 1)) {
              if (!topic.resources.some(r => r.url === item.url)) {
                topic.resources.push({
                  title: item.title,
                  url: item.url,
                  type: 'video',
                  role: 'PRIMARY',
                  description: item.description
                });
              }
            }
          }
        }
      }
    } catch (enrichErr) {
      console.warn('[Curator] Optional search enrichment skipped:', enrichErr);
    }
  }

  return generated;
}

function safeResId(url: string): string {
  try {
    return 'res_' + btoa(encodeURIComponent(url)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  } catch {
    return 'res_' + generateId().substring(0, 16);
  }
}

/**
 * Commits a validated AI curated course blueprint into Dexie database tables
 * and refreshes the in-memory curriculum store.
 */
export async function saveCuratedCourseToDatabase(blueprint: CuratedCourseResponse): Promise<string> {
  const courseId = generateId();
  const now = new Date();

  // 1. Create Course
  const course = {
    id: courseId,
    uri: generateUri('course', courseId) || '',
    name: blueprint.title,
    description: blueprint.description,
    color: blueprint.color,
    icon: blueprint.icon,
    createdAt: now,
    updatedAt: now
  };

  const modulesToInsert: any[] = [];
  const topicTemplatesToInsert: any[] = [];
  const topicProgressToInsert: any[] = [];
  const resourceTemplatesToInsert: any[] = [];
  const userResourceSelectionsToInsert: any[] = [];

  blueprint.modules.forEach((mod, mIdx) => {
    const moduleId = generateId();
    modulesToInsert.push({
      id: moduleId,
      uri: generateUri('module', moduleId) || '',
      courseId: courseId,
      name: mod.name,
      description: mod.description,
      order: mIdx,
      createdAt: now,
      updatedAt: now
    });

    mod.topics.forEach((top, tIdx) => {
      const topicId = generateId();
      topicTemplatesToInsert.push({
        id: topicId,
        uri: generateUri('topic', topicId) || '',
        moduleId: moduleId,
        courseId: courseId,
        name: top.name,
        description: top.description,
        learningOutcomes: top.learningObjectives,
        difficulty: top.difficulty,
        estimatedHours: top.estimatedHours,
        skills: top.skills,
        order: tIdx,
        createdAt: now,
        updatedAt: now
      });

      topicProgressToInsert.push({
        id: topicId,
        topicId: topicId,
        status: (mIdx === 0 && tIdx === 0 ? 'in-progress' : 'not-started') as any,
        isCompleted: false,
        createdAt: now,
        updatedAt: now
      });

      top.resources.forEach((res, rIdx) => {
        const canonicalUrl = res.url || `https://duckduckgo.com/?q=${encodeURIComponent(res.title)}`;
        const resId = safeResId(canonicalUrl);

        resourceTemplatesToInsert.push({
          id: resId,
          canonicalUrl,
          title: res.title,
          type: res.type || 'documentation',
          description: res.description,
          createdAt: now,
          updatedAt: now
        });

        userResourceSelectionsToInsert.push({
          id: generateId(),
          resourceId: resId,
          courseId: courseId,
          topicId: topicId,
          role: res.role || 'PRIMARY',
          status: 'planned' as const,
          order: rIdx,
          createdAt: now,
          updatedAt: now
        });
      });
    });
  });

  // Commit all to Dexie
  await db.courses.put(course as any);
  if (modulesToInsert.length > 0) await db.modules.bulkPut(modulesToInsert);
  if (topicTemplatesToInsert.length > 0) await db.topicTemplates.bulkPut(topicTemplatesToInsert);
  if (topicProgressToInsert.length > 0) await db.topicProgress.bulkPut(topicProgressToInsert);
  if (resourceTemplatesToInsert.length > 0) await db.resourceTemplates.bulkPut(resourceTemplatesToInsert);
  if (userResourceSelectionsToInsert.length > 0) await db.userResourceSelections.bulkPut(userResourceSelectionsToInsert);

  // Refresh curriculum store state
  await useCurriculumStore.getState().initialize(true);

  return courseId;
}
