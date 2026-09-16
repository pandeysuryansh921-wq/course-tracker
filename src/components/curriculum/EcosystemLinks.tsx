'use client';

import React from 'react';
import { Network, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { LinkedNode } from '@/types/curriculum';

interface EcosystemLinksProps {
  links: LinkedNode[];
}

export function EcosystemLinks({ links }: EcosystemLinksProps) {
  if (!links || links.length === 0) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800/50 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Network className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Connected Content</h4>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        These items were created in other apps across your personal ecosystem during this topic's study sessions.
      </p>
      
      <div className="space-y-2">
        {links.map((link, idx) => {
          // e.g., nodeUri: "ecosystem:notes:document:xyz123"
          // We can parse the app name for display if we want.
          const isNote = link.nodeUri.includes(':notes:');
          const isTask = link.nodeUri.includes(':productivity:');
          
          return (
            <a 
              key={idx}
              href={link.nodeUri.replace('ecosystem:', 'ecosystem://')} // convert to valid url for standard href if needed, but usually we just want a button that uses window.location or similar. Wait, a standard a-tag works well for custom schemes on mobile.
              className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${isNote ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : isTask ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                  <LinkIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {link.label || 'Linked Item'}
                  </span>
                  <span className="text-xs text-slate-500 capitalize">
                    {link.nodeType || 'Item'}
                  </span>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
