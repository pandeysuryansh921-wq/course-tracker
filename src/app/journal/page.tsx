'use client';

import PomodoroTimer from '@/components/journal/PomodoroTimer';
import SessionLog from '@/components/journal/SessionLog';
import { Lightbulb } from 'lucide-react';
import { useState, useEffect } from 'react';

const QUOTES = [
  "Success is the sum of small efforts, repeated day in and day out.",
  "The beautiful thing about learning is that no one can take it away from you.",
  "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.",
  "It always seems impossible until it's done.",
  "Don't let what you cannot do interfere with what you can do."
];

export default function JournalPage() {
  const [quote, setQuote] = useState(QUOTES[0]);

  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Study Journal</h1>
        <p className="text-slate-600 dark:text-slate-400">Track your focused study time and review your past sessions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Timer */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <PomodoroTimer />
          
          <div className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10 dark:from-violet-500/5 dark:to-cyan-500/5 rounded-2xl p-6 border border-violet-100 dark:border-violet-900/30 flex items-start gap-4">
            <div className="bg-violet-100 dark:bg-violet-900/50 p-2 rounded-full text-violet-600 dark:text-violet-400 flex-shrink-0">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Study Tip</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 italic">"{quote}"</p>
            </div>
          </div>
        </div>

        {/* Right Column - Logs */}
        <div className="lg:col-span-7 h-[600px] lg:h-auto min-h-[600px]">
          <SessionLog />
        </div>
      </div>
    </div>
  );
}
