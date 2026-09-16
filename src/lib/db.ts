import Dexie, { type EntityTable } from 'dexie';
import type { Course, Module, Topic, Resource, UserProfile, Flashcard, Practice, Project } from '@/types/curriculum';
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
  userProfile: EntityTable<UserProfile, 'id'>;
  flashcards: EntityTable<Flashcard, 'id'>;
  practices: EntityTable<Practice, 'id'>;
  projects: EntityTable<Project, 'id'>;
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

// Upgrade to version 2
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

// Upgrade to version 3
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

// Upgrade to version 4 (Ecosystem URIs)
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

export { db };
