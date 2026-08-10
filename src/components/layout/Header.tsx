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
      <div className="flex items-center pl-12 md:pl-0">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 hidden md:block">
          {breadcrumb}
        </h1>
        <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 md:hidden">
          {breadcrumb}
        </h1>
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
