'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  
  // Basic breadcrumb parsing
  const pathParts = pathname.split('/').filter(Boolean);
  let breadcrumb = 'Dashboard';
  
  if (pathParts.length > 0) {
    const mainPart = pathParts[0];
    breadcrumb = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
  }

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 md:px-6 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="flex items-center pl-12 md:pl-0 gap-3">
        {/* App Logo Mark */}
        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-violet-600 flex items-center justify-center text-white">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>'; }} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 hidden md:block">
            {breadcrumb}
          </h1>
          <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 md:hidden">
            {breadcrumb}
          </h1>
        </div>
      </div>
      
      <div className="flex items-center gap-2 md:gap-3">
        <button 
          id="btn-new-course"
          onClick={() => router.push('/curriculum')}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Plus size={16} />
          New Course
        </button>
      </div>
    </header>
  );
}
