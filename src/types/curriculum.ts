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
  size?: number;
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

export interface LinkedNode {
  nodeUri: string;
  nodeType: string;
  label: string;
}

export interface Course {
  id: string;
  uri?: string; // Phase 1: Stable ecosystem URIs
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
  uri?: string; // Phase 1
  courseId: string;
  name: string;
  description: string;
  order: number;
  notebookUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Concept {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceMapping {
  id: string;
  resourceId: string;
  targetType: 'concept' | 'topic';
  targetId: string;
  role?: string;
  coverage?: number;
  confidenceScore?: number; // Harvested intelligence
  successCount?: number;    // How many times this resource led to mastery
  usageCount?: number;      // How many times this resource was used
  createdAt: Date;
}

export interface ResourceTemplate {
  id: string; // canonical stable id
  canonicalUrl: string;
  title: string;
  provider?: string;
  author?: string;
  type: ResourceType | string;
  formats?: string[];
  language?: string;
  level?: string;
  estimatedHours?: number;
  description?: string;
  freeStatus?: string;
  verificationStatus?: string; 
  roles?: string[]; 
  createdAt: Date;
  updatedAt: Date;
}

export interface UserResourceSelection {
  id: string;
  resourceId: string;
  courseId: string;
  topicId?: string;
  role?: string;
  status?: 'planned' | 'in-progress' | 'completed';
  favorite?: boolean;
  personalNotes?: string;
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicTemplate {
  id: string;
  uri?: string;
  moduleId: string;
  courseId: string;
  name: string;
  description?: string;
  objectives?: string[]; 
  conceptIds?: string[];
  studyPlan?: Record<string, string>;
  scope?: any;
  learningOutcomes?: string[];
  difficulty?: string;
  learningLevel?: string;
  estimatedHours?: number;
  prerequisites?: string[];
  medicalApplications?: string[];
  completionCriteria?: any;
  order: number;
  skills?: string[];
  quizUrl?: string;
  quizMaxScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicProgress {
  id: string; // usually same as topicId for 1:1 user-to-topic relationship in local-first
  topicId: string;
  status: TopicStatus;
  isCompleted: boolean;
  isMastered?: boolean;
  masteryScore?: number;
  nextReviewDate?: Date;
  notes?: string;
  quizScore?: number;
  externalLinks?: LinkedNode[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  status: 'active' | 'completed' | 'paused';
  startedAt: Date;
  completedAt?: Date;
}

// ---------------------------------------------------------
// UI LAYER TYPES (JOINED VIEWS FOR BACKWARD COMPATIBILITY)
// ---------------------------------------------------------

export interface Topic extends TopicTemplate, Omit<TopicProgress, 'id' | 'createdAt' | 'updatedAt'> {
  resources: Resource[];
  assignments?: Assignment[];
  assignment?: any;
  quiz?: any;
}

export interface Resource extends ResourceTemplate, Omit<UserResourceSelection, 'id' | 'createdAt' | 'updatedAt'> {
  url: string; // mapped to canonicalUrl for backward compat
  scopeInstructions?: string; // mapped to role/notes
  required?: boolean;
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
  id: string; 
  name: string;
  xp: number;
  level: number;
  badges: string[]; 
  ecosystemMode?: boolean; 
  useExternalTimer?: boolean; 
  useExternalFlashcards?: boolean; 
  communityPublishingEnabled?: boolean;
  communityWebhookUrl?: string;
  communityGithubToken?: string;
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
