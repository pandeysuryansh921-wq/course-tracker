import React from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

import { GemLink } from '@/types/curriculum';

interface GeminiGemCardProps {
  gem: GemLink;
}

export default function GeminiGemCard({ gem }: GeminiGemCardProps) {

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between overflow-hidden relative">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-fuchsia-500/10 blur-3xl rounded-full" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-violet-500/10 blur-3xl rounded-full" />
      
      <div className="flex-1 relative z-10">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-500" />
          {gem.title}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 mb-0 text-sm max-w-xl leading-relaxed">
          {gem.description || "Get personalized help, generate study plans, and take practice quizzes using this dedicated Gemini Gem."}
        </p>
      </div>
      
      <div className="w-full md:w-auto relative z-10 shrink-0">
        <Button 
          onClick={() => window.open(gem.url, '_blank', 'noopener noreferrer')}
          className="w-full md:w-auto bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white border-0 shadow-md shadow-violet-500/20 py-6"
        >
          <span className="flex items-center text-base">
            Ask Course Gemini Gem <ExternalLink className="w-4 h-4 ml-2" />
          </span>
        </Button>
      </div>
    </div>
  );
}
