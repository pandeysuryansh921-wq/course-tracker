// Curriculum types for DegreeTrack

export type TopicStatus = 'not-started' | 'in-progress' | 'completed' | 'needs-review';
export type ResourceType = 'video' | 'pdf' | 'textbook' | 'article' | 'other' | 'link' | 'photo';

export interface GemLink {
  id: string;
  title: string;
  description?: string;
  url: string;
}

export type FileAttachmentType = 'link' | 'pdf' | 'image' | 'document';

export interface AssignmentFile {
  id: string;
  name: string;
  type: FileAttachmentType;
  url: string; // Base64 string, Blob URL, or stored file path
}

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  file?: AssignmentFile;
  isSubmitted: boolean;   
  submissionFile?: AssignmentFile;
  submittedAt?: string;
}

export interface Course {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  gemLinks?: GemLink[];
  syllabus?: AssignmentFile;
  curriculum?: AssignmentFile;
  targetCompletionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Module {
  id: string;
  courseId: string;
  name: string;
  description: string;
  order: number;
  notebookUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Topic {
  id: string;
  moduleId: string;
  courseId: string;
  name: string;
  status: TopicStatus;
  isCompleted: boolean;
  isMastered?: boolean;
  resources: Resource[];
  order: number;
  quizUrl?: string;
  quizScore?: number;
  quizMaxScore?: number;
  assignments?: Assignment[];
  nextReviewDate?: Date;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Resource {
  id: string;
  topicId: string;
  title: string;
  url: string;
  type: ResourceType;
  createdAt: Date;
  updatedAt: Date;
}

export interface CurriculumStats {
  totalCourses: number;
  completedCourses: number;
  totalTopics: number;
  completedTopics: number;
  overallProgress: number;
  topicsNeedsReview: number;
}

export interface UserProfile {
  id: string; // Typically just "me" since it's local
  name: string;
  xp: number;
  level: number;
  badges: string[]; // IDs or names of unlocked badges
  createdAt: Date;
  updatedAt: Date;
}

export interface Flashcard {
  id: string;
  topicId: string;
  front: string;
  back: string;
  nextReview: Date;
  interval: number;
  easeFactor: number;
  repetitions: number;
  createdAt: Date;
  updatedAt: Date;
}
