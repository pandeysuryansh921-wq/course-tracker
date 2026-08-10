import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

import { GemLink } from '@/types/curriculum';

interface GeminiGemCardProps {
  gem: GemLink;
}

export default function GeminiGemCard({ gem }: GeminiGemCardProps) {
  const [copied, setCopied] = useState(false);
  const starterPrompt = "Hello! I am a student taking this course. Can you help me build a study plan and quiz me on the key concepts?";

  const handleCopy = () => {
    navigator.clipboard.writeText(starterPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm max-w-xl leading-relaxed">
          {gem.description || "Get personalized help, generate study plans, and take practice quizzes using this dedicated Gemini Gem."}
        </p>
        
        <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-4 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-xl group">
          <p className="text-sm text-slate-500 dark:text-slate-400 italic flex-1 line-clamp-2">
            "{starterPrompt}"
          </p>
          <button 
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 transition-colors shrink-0 shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
        </div>
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
