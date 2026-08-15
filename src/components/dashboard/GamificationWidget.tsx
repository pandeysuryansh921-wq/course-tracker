'use client';

import { useUserStore } from '@/stores/useUserStore';
import { Award, Star, Zap } from 'lucide-react';

export function GamificationWidget() {
  const profile = useUserStore((state) => state.profile);

  if (!profile) return null;

  const xpForNextLevel = profile.level * 100;
  const xpInCurrentLevel = profile.xp % 100;
  const progressPercentage = (xpInCurrentLevel / 100) * 100;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 flex flex-col justify-center relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Award size={100} className="text-violet-600 dark:text-violet-400" />
      </div>
      
      <div className="flex items-center gap-4 mb-6 relative z-10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30 text-white font-bold text-2xl border-4 border-white dark:border-slate-800">
          {profile.level}
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Level {profile.level}</h2>
          <p className="text-sm font-medium text-violet-600 dark:text-violet-400 flex items-center gap-1">
            <Zap size={14} />
            {profile.xp} Total XP
          </p>
        </div>
      </div>

      <div className="relative z-10 w-full mb-2">
        <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
          <span>Current Level</span>
          <span>Next Level ({xpForNextLevel} XP)</span>
        </div>
        <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-1000 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="text-xs text-right mt-1 text-slate-400 dark:text-slate-500">
          {100 - xpInCurrentLevel} XP to Level {profile.level + 1}
        </div>
      </div>

      {profile.badges.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/50 relative z-10">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Star size={16} className="text-amber-500" />
            Trophy Room
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.badges.map(badge => (
              <span key={badge} className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full border border-amber-200 dark:border-amber-800/50">
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
