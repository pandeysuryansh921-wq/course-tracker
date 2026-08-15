import { create } from 'zustand';
import { db } from '@/lib/db';
import { StudySession, TimerMode, TimerState, TimerConfig } from '@/types/journal';
import { generateId } from '@/lib/utils';

interface TimerStateStore {
  mode: TimerMode;
  state: TimerState;
  timeRemaining: number;
  timeElapsed: number;
  currentSession: number;
  selectedTopicId?: string;
  selectedTopicName?: string;
  selectedCourseId?: string;
  selectedCourseName?: string;
  config: TimerConfig;
  sessions: StudySession[];

  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => Promise<void>;
  skipBreak: () => void;
  tick: () => void;
  setMode: (mode: TimerMode) => void;
  setTopic: (topicId?: string, topicName?: string, courseId?: string, courseName?: string) => void;
  updateConfig: (updates: Partial<TimerConfig>) => void;
  completeSession: () => Promise<void>;
  getSessions: () => Promise<void>;
}

const DEFAULT_CONFIG: TimerConfig = {
  workDuration: 25 * 60,
  breakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  longBreakInterval: 4
};

export const useTimerStore = create<TimerStateStore>((set, get) => ({
  mode: 'pomodoro',
  state: 'idle',
  timeRemaining: DEFAULT_CONFIG.workDuration,
  timeElapsed: 0,
  currentSession: 1,
  config: DEFAULT_CONFIG,
  sessions: [],

  startTimer: () => {
    const { mode } = get();
    if (mode === 'stopwatch') {
      set({ state: 'running', timeElapsed: 0 });
    } else {
      set({ state: 'running' });
    }
  },

  pauseTimer: () => set({ state: 'paused' }),
  
  resumeTimer: () => set({ state: 'running' }),

  resetTimer: async () => {
    const { mode, config, timeElapsed } = get();
    if (mode === 'stopwatch' && timeElapsed > 0) {
      await get().completeSession();
    }
    set({
      state: 'idle',
      timeRemaining: mode === 'pomodoro' ? config.workDuration : 0,
      timeElapsed: 0
    });
  },

  skipBreak: () => {
    const { mode, config } = get();
    if (mode === 'short-break' || mode === 'long-break') {
      set({
        mode: 'pomodoro',
        state: 'idle',
        timeRemaining: config.workDuration
      });
    }
  },

  tick: () => {
    const { state, mode, timeRemaining, timeElapsed, config, currentSession } = get();
    if (state !== 'running') return;

    if (mode === 'stopwatch') {
      set({ timeElapsed: timeElapsed + 1 });
    } else {
      if (timeRemaining > 0) {
        set({ timeRemaining: timeRemaining - 1, timeElapsed: timeElapsed + 1 });
      } else {
        // Complete current phase
        if (mode === 'pomodoro') {
          get().completeSession();
          const nextSession = currentSession + 1;
          const isLongBreak = nextSession > config.longBreakInterval;
          
          set({
            mode: isLongBreak ? 'long-break' : 'short-break',
            timeRemaining: isLongBreak ? config.longBreakDuration : config.breakDuration,
            state: 'idle',
            currentSession: isLongBreak ? 1 : nextSession,
            timeElapsed: 0
          });
        } else {
          // Break is over
          set({
            mode: 'pomodoro',
            timeRemaining: config.workDuration,
            state: 'idle',
            timeElapsed: 0
          });
        }
      }
    }
  },

  setMode: (mode) => {
    const { config } = get();
    set({
      mode,
      state: 'idle',
      timeRemaining: 
        mode === 'pomodoro' ? config.workDuration :
        mode === 'short-break' ? config.breakDuration :
        mode === 'long-break' ? config.longBreakDuration : 0,
      timeElapsed: 0
    });
  },

  setTopic: (topicId, topicName, courseId, courseName) => {
    set({ selectedTopicId: topicId, selectedTopicName: topicName, selectedCourseId: courseId, selectedCourseName: courseName });
  },

  updateConfig: (updates) => {
    const { config, mode, state } = get();
    const newConfig = { ...config, ...updates };
    
    // Only update time remaining if timer is idle and we updated the duration of the current mode
    let newTimeRemaining = get().timeRemaining;
    if (state === 'idle') {
      if (mode === 'pomodoro' && updates.workDuration) newTimeRemaining = updates.workDuration;
      else if (mode === 'short-break' && updates.breakDuration) newTimeRemaining = updates.breakDuration;
      else if (mode === 'long-break' && updates.longBreakDuration) newTimeRemaining = updates.longBreakDuration;
    }

    set({ config: newConfig, timeRemaining: newTimeRemaining });
  },

  completeSession: async () => {
    const { mode, timeElapsed, selectedTopicId, selectedCourseId, selectedTopicName, selectedCourseName } = get();
    if (timeElapsed === 0) return;

    const session: StudySession = {
      id: generateId(),
      topicId: selectedTopicId,
      topicName: selectedTopicName || 'General Study',
      courseId: selectedCourseId,
      courseName: selectedCourseName || 'Unassigned',
      duration: timeElapsed,
      type: mode === 'stopwatch' ? 'stopwatch' : 'pomodoro',
      startedAt: new Date(Date.now() - timeElapsed * 1000),
      endedAt: new Date(),
      notes: ''
    };

    await db.studySessions.put(session);
    set(state => ({ sessions: [...state.sessions, session] }));

    // Award XP based on duration (1 XP per minute)
    const earnedXP = Math.floor(timeElapsed / 60);
    if (earnedXP > 0) {
      import('@/stores/useUserStore').then(({ useUserStore }) => {
        useUserStore.getState().addXP(earnedXP);
      });
    }
  },

  getSessions: async () => {
    try {
      const sessions = await db.studySessions.toArray();
      set({ sessions });
    } catch (error) {
      console.error('Failed to load study sessions', error);
    }
  }
}));
