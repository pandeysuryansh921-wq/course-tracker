import { Course, Module, Topic, CourseProgressionMode } from '@/types/curriculum';

/**
 * Returns the effective CourseProgressionMode for a course.
 * Invariant: ORDER ≠ PREREQUISITE
 * - Authored curricula without driveFolderId default to 'STRUCTURED' (preserving existing prerequisites).
 * - Drive-imported courses default to 'ORDERED_LIBRARY' (recommended sequence without false prerequisite locking).
 * - Explicit course.progressionMode takes precedence if configured.
 */
export function getCourseProgressionMode(course?: {
  progressionMode?: CourseProgressionMode;
  driveFolderId?: string;
}): CourseProgressionMode {
  if (course?.progressionMode) {
    return course.progressionMode;
  }
  if (course?.driveFolderId) {
    return 'ORDERED_LIBRARY';
  }
  return 'STRUCTURED';
}

/**
 * Returns the canonical flat sequence of topics for a course.
 * Used as the single source of truth for:
 * 1. UI Display Order
 * 2. Previous Lecture Navigation
 * 3. Next Lecture Navigation
 * 4. Rolling Smart Prefetch
 * 5. Continue Learning / Progress Tracking
 */
export function getCanonicalOrderedTopics(
  courseId: string,
  topics: Topic[],
  modules: Module[]
): Topic[] {
  const courseTopics = topics.filter((t) => t.courseId === courseId);
  if (courseTopics.length === 0) return [];

  // 1. If topics have sequenceIndex assigned, use canonical sequenceIndex
  const hasSequenceIndex = courseTopics.some((t) => typeof t.sequenceIndex === 'number' && t.sequenceIndex > 0);
  if (hasSequenceIndex) {
    return [...courseTopics].sort((a, b) => {
      const seqA = typeof a.sequenceIndex === 'number' ? a.sequenceIndex : 99999;
      const seqB = typeof b.sequenceIndex === 'number' ? b.sequenceIndex : 99999;
      if (seqA !== seqB) return seqA - seqB;
      return a.order - b.order;
    });
  }

  // 2. Otherwise sort by module.order, then topic.order
  const courseModules = modules
    .filter((m) => m.courseId === courseId)
    .sort((a, b) => a.order - b.order);

  if (courseModules.length > 0) {
    const result: Topic[] = [];
    for (const m of courseModules) {
      const mTopics = courseTopics
        .filter((t) => t.moduleId === m.id)
        .sort((a, b) => a.order - b.order);
      result.push(...mTopics);
    }
    // Also include any orphan topics without valid module
    const orphanTopics = courseTopics
      .filter((t) => !courseModules.some((m) => m.id === t.moduleId))
      .sort((a, b) => a.order - b.order);
    result.push(...orphanTopics);
    return result;
  }

  return [...courseTopics].sort((a, b) => a.order - b.order);
}

/**
 * Gets the next topic in canonical sequence.
 */
export function getCanonicalNextTopic(
  currentTopicId: string,
  courseId: string,
  topics: Topic[],
  modules: Module[]
): Topic | null {
  const ordered = getCanonicalOrderedTopics(courseId, topics, modules);
  const idx = ordered.findIndex((t) => t.id === currentTopicId);
  if (idx === -1 || idx + 1 >= ordered.length) return null;
  return ordered[idx + 1];
}

/**
 * Gets the previous topic in canonical sequence.
 */
export function getCanonicalPreviousTopic(
  currentTopicId: string,
  courseId: string,
  topics: Topic[],
  modules: Module[]
): Topic | null {
  const ordered = getCanonicalOrderedTopics(courseId, topics, modules);
  const idx = ordered.findIndex((t) => t.id === currentTopicId);
  if (idx <= 0) return null;
  return ordered[idx - 1];
}
