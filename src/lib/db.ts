// Dexie.js IndexedDB database for DegreeTrack
import Dexie, { type EntityTable } from 'dexie';
import type { Course, Module, Topic, Resource } from '@/types/curriculum';
import type { Quiz, QuizResult } from '@/types/quiz';
import type { StudySession } from '@/types/journal';

const db = new Dexie('DegreeTrackDB') as Dexie & {
  courses: EntityTable<Course, 'id'>;
  modules: EntityTable<Module, 'id'>;
  topics: EntityTable<Topic, 'id'>;
  resources: EntityTable<Resource, 'id'>;
  quizzes: EntityTable<Quiz, 'id'>;
  quizResults: EntityTable<QuizResult, 'id'>;
  studySessions: EntityTable<StudySession, 'id'>;
};

db.version(1).stores({
  courses: 'id, name, createdAt',
  modules: 'id, courseId, order, createdAt',
  topics: 'id, moduleId, courseId, status, order, nextReviewDate, createdAt',
  resources: 'id, topicId',
  quizzes: 'id, topicId, createdAt',
  quizResults: 'id, quizId, topicId, completedAt',
  studySessions: 'id, topicId, courseId, startedAt, endedAt',
});

export { db };
