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
  topicId?: string; // New in V2 for relational linking
  moduleId?: string; // New in V2
  courseId?: string; // New in V2
  title: string;
  description?: string;
  type?: string;
  difficulty?: string;
  estimatedHours?: number;
  order?: number;
  objective?: string;
  tasks?: string[];
  requirements?: string[];
  skillsTested?: string[];
  deliverables?: string[];
  hints?: string[];
  evaluationCriteria?: Record<string, number>;
  passScore?: number;
  masteryScore?: number;
  submissionType?: string;
  file?: AssignmentFile;
  isSubmitted: boolean;   
  submissionFile?: AssignmentFile;
  submittedAt?: string;
}

export interface Practice {
  id: string;
  topicId: string;
  moduleId: string;
  courseId: string;
  title: string;
  description?: string;
  type?: string;
  difficulty?: string;
  estimatedMinutes?: number;
  estimatedHours?: number;
  order?: number;
  objective?: string;
  tasks?: string[];
  skillsTested?: string[];
  hints?: string[];
  deliverable?: string;
  solutionPolicy?: string;
  completionCriteria?: {
    minimum?: string;
    mastery?: string;
  };
}

export interface Project {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  estimatedHours: number;
  order: number;
  objective?: string;
  requiredTopics?: string[];
  requirements: string[];
  milestones?: {
    id: string;
    title: string;
    description: string;
    estimatedHours: number;
    deliverables: string[];
  }[];
  deliverables: string[];
  evaluationCriteria?: Record<string, number>;
  passScore?: number;
  masteryScore?: number;
  isSubmitted?: boolean;
  submissionLink?: string;
  medicalDomain?: string;
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
  assessment?: {
    practiceWeight?: number;
    assignmentWeight?: number;
    quizWeight?: number;
    projectWeight?: number;
  };
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
  description?: string;
  studyPlan?: Record<string, string>;
  scope?: {
    core?: string[];
    important?: string[];
    optional?: string[];
    skip?: string[];
  };
  learningOutcomes?: string[];
  difficulty?: string;
  learningLevel?: string;
  estimatedHours?: number;
  prerequisites?: string[];
  medicalApplications?: string[];
  completionCriteria?: {
    minimum?: string[];
    mastery?: string[];
  };
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
  type: ResourceType | string;
  freeStatus?: string;
  estimatedHours?: number;
  description?: string;
  scopeInstructions?: string;
  required?: boolean;
  order?: number;
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
