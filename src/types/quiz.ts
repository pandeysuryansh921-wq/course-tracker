// Quiz types for DegreeTrack

export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'mcq' | 'short-answer';
export type QuizStatus = 'setup' | 'in-progress' | 'completed';

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  userAnswer?: string;
  isCorrect?: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  topicId?: string;
  topicName?: string;
  courseId?: string;
  courseName?: string;
  sourceText?: string;
  difficulty: Difficulty;
  questionCount: number;
  questions: Question[];
  status: QuizStatus;
  createdAt: Date;
}

export interface QuizResult {
  id: string;
  quizId: string;
  topicId?: string;
  topicName?: string;
  courseId?: string;
  courseName?: string;
  difficulty: Difficulty;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeTaken: number;
  completedAt: Date;
  answers?: Record<string, string>;
}

export interface QuizConfig {
  inputMethod: 'paste' | 'topic';
  sourceText: string;
  topicId?: string;
  courseId?: string;
  questionCount: 5 | 10 | 15;
  difficulty: Difficulty;
}
