'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  GraduationCap, 
  LayoutDashboard, 
  BookOpen, 
  Brain, 
  Clock, 
  BarChart3, 
  Sun, 
  Moon,
  Menu,
  X
} from 'lucide-react';
import { useThemeStore } from '@/stores/useThemeStore';
import { useSidebarStore } from '@/stores/useSidebarStore';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/curriculum', label: 'Curriculum', icon: BookOpen },
  { href: '/journal', label: 'Journal', icon: Clock },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useThemeStore();
  const { isOpen, setIsOpen } = useSidebarStore();

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40
        w-[260px] flex flex-col
        bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xl
        border-r border-slate-200 dark:border-slate-800
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo/Brand */}
        <div 
          className="flex items-center gap-3 px-6 border-b border-slate-200 dark:border-slate-800 md:justify-start justify-center pb-4"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 24px) + 16px)' }}
        >
          <GraduationCap className="text-violet-600 dark:text-violet-400" size={28} />
          <span className="font-bold text-xl bg-gradient-to-r from-violet-600 to-teal-500 bg-clip-text text-transparent">
            DegreeTrack
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            
            return (
              <Link 
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                id={`nav-${item.label.toLowerCase()}`}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-all duration-200 group relative
                  ${isActive 
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'}
                `}
              >
                {isActive && (
                  <div className="absolute left-0 top-1 bottom-1 w-1 bg-violet-600 dark:bg-violet-500 rounded-r-full" />
                )}
                <Icon size={20} className={`
                  transition-transform group-hover:scale-110
                  ${isActive ? 'text-violet-600 dark:text-violet-400' : ''}
                `} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div 
          className="px-4 pt-4 border-t border-slate-200 dark:border-slate-800"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 16px)' }}
        >
          <button
            onClick={toggleTheme}
            id="theme-toggle-btn"
            className="flex items-center justify-between w-full px-4 py-3 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="transition-transform group-hover:rotate-12">
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </div>
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
