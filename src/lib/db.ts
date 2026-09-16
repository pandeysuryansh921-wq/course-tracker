import Dexie, { type EntityTable } from 'dexie';
import type { 
  Course, Module, UserProfile, Flashcard, Practice, Project,
  TopicTemplate, TopicProgress, Concept, ResourceTemplate, UserResourceSelection, ResourceMapping, CourseEnrollment 
} from '@/types/curriculum';
import type { Quiz, QuizResult } from '@/types/quiz';
import type { StudySession } from '@/types/journal';

const db = new Dexie('DegreeTrackDB') as Dexie & {
  courses: EntityTable<Course, 'id'>;
  modules: EntityTable<Module, 'id'>;
  
  // Phase 1 Decoupling
  topicTemplates: EntityTable<TopicTemplate, 'id'>;
  topicProgress: EntityTable<TopicProgress, 'id'>;
  concepts: EntityTable<Concept, 'id'>;
  resourceTemplates: EntityTable<ResourceTemplate, 'id'>;
  userResourceSelections: EntityTable<UserResourceSelection, 'id'>;
  resourceMappings: EntityTable<ResourceMapping, 'id'>;
  courseEnrollments: EntityTable<CourseEnrollment, 'id'>;

  // Legacy (Keep types for migration scripts if needed, but we cast to any in upgrade)
  topics: EntityTable<any, 'id'>;
  resources: EntityTable<any, 'id'>;

  quizzes: EntityTable<Quiz, 'id'>;
  quizResults: EntityTable<QuizResult, 'id'>;
  studySessions: EntityTable<StudySession, 'id'>;
  userProfile: EntityTable<UserProfile, 'id'>;
  flashcards: EntityTable<Flashcard, 'id'>;
  practices: EntityTable<Practice, 'id'>;
  projects: EntityTable<Project, 'id'>;
};

// ... V1 to V4 schemas remain unchanged for backward compatibility ...
db.version(1).stores({
  courses: 'id, name, createdAt',
  modules: 'id, courseId, order, createdAt',
  topics: 'id, moduleId, courseId, status, order, nextReviewDate, createdAt',
  resources: 'id, topicId',
  quizzes: 'id, topicId, createdAt',
  quizResults: 'id, quizId, topicId, completedAt',
  studySessions: 'id, topicId, courseId, startedAt, endedAt',
});

db.version(2).stores({
  courses: 'id, name, createdAt',
  modules: 'id, courseId, order, createdAt',
  topics: 'id, moduleId, courseId, status, order, nextReviewDate, createdAt',
  resources: 'id, topicId',
  quizzes: 'id, topicId, createdAt',
  quizResults: 'id, quizId, topicId, completedAt',
  studySessions: 'id, topicId, courseId, startedAt, endedAt',
  userProfile: 'id',
  flashcards: 'id, topicId, nextReview',
});

db.version(3).stores({
  courses: 'id, name, createdAt',
  modules: 'id, courseId, order, createdAt',
  topics: 'id, moduleId, courseId, status, order, nextReviewDate, createdAt',
  resources: 'id, topicId',
  quizzes: 'id, topicId, createdAt',
  quizResults: 'id, quizId, topicId, completedAt',
  studySessions: 'id, topicId, courseId, startedAt, endedAt',
  userProfile: 'id',
  flashcards: 'id, topicId, nextReview',
  practices: 'id, topicId, moduleId, courseId',
  projects: 'id, moduleId, courseId',
});

db.version(4).stores({
  courses: 'id, uri, name, createdAt',
  modules: 'id, uri, courseId, order, createdAt',
  topics: 'id, uri, moduleId, courseId, status, order, nextReviewDate, createdAt',
}).upgrade(tx => {
  return Promise.all([
    tx.table('courses').toCollection().modify(course => {
      if (!course.uri) course.uri = `ecosystem:learn:course:${course.id}`;
    }),
    tx.table('modules').toCollection().modify(module => {
      if (!module.uri) module.uri = `ecosystem:learn:module:${module.id}`;
    }),
    tx.table('topics').toCollection().modify(topic => {
      if (!topic.uri) topic.uri = `ecosystem:learn:topic:${topic.id}`;
      if (!topic.externalLinks) topic.externalLinks = [];
    })
  ]);
});

// Upgrade to version 5 (Phase 1 Decoupling)
db.version(5).stores({
  topicTemplates: 'id, moduleId, courseId, uri',
  topicProgress: 'id, topicId, status, nextReviewDate',
  concepts: 'id, name',
  resourceTemplates: 'id, canonicalUrl, type',
  userResourceSelections: 'id, resourceId, courseId, topicId, status',
  resourceMappings: 'id, resourceId, targetId, targetType',
  courseEnrollments: 'id, courseId, status',
  
  // Keep legacy stores in schema so data isn't deleted, though we won't query them in the app
  topics: 'id, uri, moduleId, courseId, status, order, nextReviewDate, createdAt',
  resources: 'id, topicId'
}).upgrade(async tx => {
  // 1. Migrate Topics -> TopicTemplate + TopicProgress
  const topics = await tx.table('topics').toArray();
  const templates: any[] = [];
  const progress: any[] = [];
  
  for (const t of topics) {
    templates.push({
      id: t.id,
      uri: t.uri,
      moduleId: t.moduleId,
      courseId: t.courseId,
      name: t.name,
      description: t.description,
      studyPlan: t.studyPlan,
      scope: t.scope,
      learningOutcomes: t.learningOutcomes,
      difficulty: t.difficulty,
      learningLevel: t.learningLevel,
      estimatedHours: t.estimatedHours,
      prerequisites: t.prerequisites,
      medicalApplications: t.medicalApplications,
      completionCriteria: t.completionCriteria,
      order: t.order,
      skills: t.skills,
      quizUrl: t.quizUrl,
      quizMaxScore: t.quizMaxScore,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    });

    progress.push({
      id: t.id,
      topicId: t.id,
      status: t.status || 'not-started',
      isCompleted: t.isCompleted || false,
      isMastered: t.isMastered,
      quizScore: t.quizScore,
      nextReviewDate: t.nextReviewDate,
      notes: t.notes,
      externalLinks: t.externalLinks,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    });
  }

  if (templates.length > 0) await tx.table('topicTemplates').bulkAdd(templates);
  if (progress.length > 0) await tx.table('topicProgress').bulkAdd(progress);

  // 2. Migrate Resources -> ResourceTemplate + UserResourceSelection
  const resources = await tx.table('resources').toArray();
  const resTemplates: any[] = [];
  const selections: any[] = [];

  for (const r of resources) {
    // Basic deterministic ID for template based on URL (to avoid dupes in this run)
    const templateId = `res_${btoa(r.url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}`;
    
    // Check if we already added it in this loop (to deduplicate same URL)
    if (!resTemplates.find(rt => rt.canonicalUrl === r.url)) {
      resTemplates.push({
        id: templateId,
        canonicalUrl: r.url,
        title: r.title,
        type: r.type,
        freeStatus: r.freeStatus,
        estimatedHours: r.estimatedHours,
        description: r.description,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      });
    }

    selections.push({
      id: r.id, // keep original ID for selection
      resourceId: templateId,
      courseId: '', // Ideally we'd look this up from topic, but we'll leave it blank if not available
      topicId: r.topicId,
      role: r.scopeInstructions, // map instructions to role temporarily
      status: 'planned',
      order: r.order,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    });
  }

  if (resTemplates.length > 0) await tx.table('resourceTemplates').bulkAdd(resTemplates);
  if (selections.length > 0) await tx.table('userResourceSelections').bulkAdd(selections);
});

export { db };
