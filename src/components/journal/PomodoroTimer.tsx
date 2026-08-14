'use client';

import { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Timer as TimerIcon, Clock, Coffee, BookOpen, Settings } from 'lucide-react';
import { useTimerStore } from '@/stores/useTimerStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { formatTimer } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

// Isolated component for the timer display to prevent parent re-renders on every tick
const TimerDisplay = () => {
  const timeRemaining = useTimerStore(state => state.timeRemaining);
  const timeElapsed = useTimerStore(state => state.timeElapsed);
  const mode = useTimerStore(state => state.mode);
  const currentSession = useTimerStore(state => state.currentSession);
  const config = useTimerStore(state => state.config);

  const totalTime = mode === 'pomodoro' ? config.workDuration : 
     mode === 'short-break' ? config.breakDuration : 
     mode === 'long-break' ? config.longBreakDuration : 0;
     
  const progress = mode !== 'stopwatch' && totalTime > 0 ? ((totalTime - timeRemaining) / totalTime) * 100 : 0;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = mode !== 'stopwatch' ? circumference - (progress / 100) * circumference : 0;

  const phaseColor = mode === 'stopwatch' ? 'text-cyan-500' : 
                     mode === 'pomodoro' ? 'text-violet-500' : 
                     'text-emerald-500';
                     
  const strokeColor = mode === 'stopwatch' ? 'stroke-cyan-500' : 
                      mode === 'pomodoro' ? 'stroke-violet-500' : 
                      'stroke-emerald-500';

  return (
    <div className="relative flex items-center justify-center mb-8 h-72 w-72 shrink-0">
      <svg className="w-72 h-72 transform -rotate-90 shrink-0">
        <circle
          cx="144"
          cy="144"
          r={radius}
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth="12"
          fill="none"
        />
        <circle
          cx="144"
          cy="144"
          r={radius}
          className={`${strokeColor} transition-all duration-1000 ease-linear`}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center pointer-events-none w-48">
        {mode !== 'stopwatch' ? (
          <div className={`flex items-center gap-2 mb-2 ${phaseColor} h-6`}>
            {mode === 'pomodoro' ? <BookOpen className="w-5 h-5" /> : <Coffee className="w-5 h-5" />}
            <span className="font-semibold uppercase tracking-wider text-sm">
              {mode === 'pomodoro' ? 'Focus' : mode === 'short-break' ? 'Break' : 'Long Break'}
            </span>
          </div>
        ) : (
          <div className={`flex items-center gap-2 mb-2 ${phaseColor} h-6`}>
            <Clock className="w-5 h-5" />
            <span className="font-semibold uppercase tracking-wider text-sm">
              Stopwatch
            </span>
          </div>
        )}
        <div 
          className="text-6xl font-bold text-slate-800 dark:text-white tracking-tighter w-full text-center h-16 flex items-center justify-center"
          style={{ fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}
        >
          {formatTimer(mode === 'stopwatch' ? timeElapsed : timeRemaining)}
        </div>
        <div className="mt-2 text-slate-500 dark:text-slate-400 font-medium h-6 flex items-center justify-center">
          {mode !== 'stopwatch' && (
            <span>Session {currentSession} of {config.longBreakInterval}</span>
          )}
        </div>
      </div>
      <div className={`absolute inset-0 rounded-full animate-ping opacity-10 pointer-events-none ${mode === 'pomodoro' || mode === 'stopwatch' ? 'bg-violet-500' : 'bg-emerald-500'}`}></div>
    </div>
  );
};

export default function PomodoroTimer() {
  const {
    mode, state,
    selectedTopicId, selectedCourseId, config,
    startTimer, pauseTimer, resumeTimer, resetTimer, skipBreak, tick, setMode, setTopic, updateConfig
  } = useTimerStore();

  const { courses, getCourseModules, getModuleTopics } = useCurriculumStore();

  const [localCourseId, setLocalCourseId] = useState(selectedCourseId || '');
  const [localTopicId, setLocalTopicId] = useState(selectedTopicId || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Settings form state
  const [workMinutes, setWorkMinutes] = useState(String(config.workDuration / 60));
  const [shortBreakMinutes, setShortBreakMinutes] = useState(String(config.breakDuration / 60));
  const [longBreakMinutes, setLongBreakMinutes] = useState(String(config.longBreakDuration / 60));

  // Keep settings state in sync with config when modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      setWorkMinutes(String(config.workDuration / 60));
      setShortBreakMinutes(String(config.breakDuration / 60));
      setLongBreakMinutes(String(config.longBreakDuration / 60));
    }
  }, [isSettingsOpen, config]);

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig({
      workDuration: parseInt(workMinutes) * 60 || 25 * 60,
      breakDuration: parseInt(shortBreakMinutes) * 60 || 5 * 60,
      longBreakDuration: parseInt(longBreakMinutes) * 60 || 15 * 60,
    });
    setIsSettingsOpen(false);
  };

  // Beep sound function
  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error('Audio play failed', e);
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, options);
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'running') {
      interval = setInterval(() => {
        const prevRemaining = useTimerStore.getState().timeRemaining;
        tick();
        const newRemaining = useTimerStore.getState().timeRemaining;
        
        if (mode !== 'stopwatch' && prevRemaining > 0 && newRemaining === 0) {
           playBeep();
           sendNotification('Session Complete!', { body: 'Great job! Time for a break.' });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state, tick, mode]);

  // Handle course/topic changes
  useEffect(() => {
    if (localTopicId && localCourseId) {
       const course = courses.find(c => c.id === localCourseId);
       let topicName = '';
       if (course) {
          const modules = getCourseModules(course.id);
          for (const m of modules) {
            const topics = getModuleTopics(m.id);
            const t = topics.find(t => t.id === localTopicId);
            if (t) {
               topicName = t.name;
               break;
            }
          }
       }
       setTopic(localTopicId, topicName, localCourseId, course?.name || '');
    }
  }, [localTopicId, localCourseId, courses, getCourseModules, getModuleTopics, setTopic]);

  const availableModules = localCourseId ? getCourseModules(localCourseId) : [];
  const availableTopics = availableModules.flatMap(m => getModuleTopics(m.id));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col items-center w-full max-w-md mx-auto relative z-0 min-h-[550px]">
      
      {/* Header / Mode Toggle */}
      <div className="flex items-center justify-between w-full mb-8 relative z-20 gap-2">
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-full p-1 flex-1">
          <button
            onClick={() => setMode('pomodoro')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-full text-xs sm:text-sm font-medium transition-all ${
              mode !== 'stopwatch' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-violet-600 dark:text-violet-400' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <TimerIcon className="w-4 h-4" />
            Pomodoro
          </button>
          <button
            onClick={() => setMode('stopwatch')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-full text-xs sm:text-sm font-medium transition-all ${
              mode === 'stopwatch' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-600 dark:text-cyan-400' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            Stopwatch
          </button>
        </div>

        {/* Settings Button */}
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
          title="Timer Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <TimerDisplay />

      {/* Controls */}
      <div className="flex items-center gap-4 mb-8 relative z-20">
        {state === 'running' ? (
          <button 
            onClick={pauseTimer}
            className="w-16 h-16 rounded-full bg-slate-800 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 shadow-lg hover:scale-105 transition-transform"
          >
            <Pause className="w-8 h-8" />
          </button>
        ) : (
          <button 
            onClick={state === 'paused' ? resumeTimer : startTimer}
            className="w-16 h-16 rounded-full bg-violet-600 hover:bg-violet-700 flex items-center justify-center text-white shadow-lg shadow-violet-500/30 hover:scale-105 transition-transform"
          >
            <Play className="w-8 h-8 ml-1" />
          </button>
        )}
        
        <button 
          onClick={resetTimer}
          className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {mode !== 'pomodoro' && mode !== 'stopwatch' && (
          <button 
            onClick={skipBreak}
            className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Skip Break"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Topic Selection */}
      <div className="w-full space-y-3 relative z-20">
        <select 
          value={localCourseId}
          onChange={(e) => {
             setLocalCourseId(e.target.value);
             setLocalTopicId('');
          }}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
        >
          <option value="">Select a Course...</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {localCourseId && (
          <select 
            value={localTopicId}
            onChange={(e) => setLocalTopicId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
          >
            <option value="">Select a Topic to link...</option>
            {availableTopics.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Timer Settings">
        <form onSubmit={saveSettings} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Focus (min)</label>
              <Input 
                type="number" 
                min="1" max="120" 
                value={workMinutes} 
                onChange={e => setWorkMinutes(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Short Break (min)</label>
              <Input 
                type="number" 
                min="1" max="60" 
                value={shortBreakMinutes} 
                onChange={e => setShortBreakMinutes(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Long Break (min)</label>
              <Input 
                type="number" 
                min="1" max="60" 
                value={longBreakMinutes} 
                onChange={e => setLongBreakMinutes(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
             <Button type="button" variant="secondary" onClick={() => {
                setWorkMinutes('15'); setShortBreakMinutes('5'); setLongBreakMinutes('15');
             }} className="flex-1">15m Focus</Button>
             <Button type="button" variant="secondary" onClick={() => {
                setWorkMinutes('25'); setShortBreakMinutes('5'); setLongBreakMinutes('15');
             }} className="flex-1">25m Focus</Button>
             <Button type="button" variant="secondary" onClick={() => {
                setWorkMinutes('45'); setShortBreakMinutes('10'); setLongBreakMinutes('20');
             }} className="flex-1">45m Focus</Button>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

