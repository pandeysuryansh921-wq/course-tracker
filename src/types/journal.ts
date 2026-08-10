// Journal types for DegreeTrack

export type TimerMode = 'pomodoro' | 'stopwatch' | 'short-break' | 'long-break';
export type TimerState = 'idle' | 'running' | 'paused' | 'break';

export interface StudySession {
  id: string;
  topicId?: string;
  topicName?: string;
  courseId?: string;
  courseName?: string;
  duration: number; // seconds
  type: TimerMode;
  notes: string;
  startedAt: Date;
  endedAt: Date;
}

export interface TimerConfig {
  workDuration: number;   // seconds (default 25 * 60)
  breakDuration: number;  // seconds (default 5 * 60)
  longBreakDuration: number; // seconds (default 15 * 60)
  longBreakInterval: number; // every N sessions (default 4)
}
