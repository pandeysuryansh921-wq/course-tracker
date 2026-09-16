const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf-8');

content = content.replace(
  '<div className="grid gap-4 sm:grid-cols-3">',
  '<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">'
);

const studyTimerLink =         <Link href="/journal" className="group flex items-center space-x-4 rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-green-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-green-700">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 group-hover:bg-green-200 dark:bg-green-500/20 dark:group-hover:bg-green-500/30">
            <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Study Timer</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Focus on a session</p>
          </div>
        </Link>;

const studyEngineLink = 
        <Link href="/study" className="group flex items-center space-x-4 rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-pink-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-pink-700">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 group-hover:bg-pink-200 dark:bg-pink-500/20 dark:group-hover:bg-pink-500/30">
            <Target className="h-6 w-6 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Study Engine</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your optimal path</p>
          </div>
        </Link>;

content = content.replace(studyTimerLink, studyTimerLink + studyEngineLink);
content = content.replace("import { BookOpen, Calendar, CheckCircle, Clock, Flame, Plus } from 'lucide-react';", "import { BookOpen, Calendar, CheckCircle, Clock, Flame, Plus, Target } from 'lucide-react';");

fs.writeFileSync('src/app/dashboard/page.tsx', content);
