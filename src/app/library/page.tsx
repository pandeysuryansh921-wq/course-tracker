'use client';

import React, { useState, useMemo } from 'react';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { Library, Search, FileText, Video, BookOpen, Globe, Link as LinkIcon, File, Star } from 'lucide-react';
import { Resource, ResourceMapping } from '@/types/curriculum';
import { db } from '@/lib/db';

export default function LibraryPage() {
  const resources = useCurriculumStore(state => state.resources);
  const topics = useCurriculumStore(state => state.topics);
  const courses = useCurriculumStore(state => state.courses);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [analytics, setAnalytics] = useState<Record<string, { confidence: number, success: number }>>({});

  React.useEffect(() => {
    db.resourceMappings.toArray().then(mappings => {
      const stats: Record<string, { confidence: number, success: number }> = {};
      mappings.forEach(m => {
        if (!stats[m.resourceId]) stats[m.resourceId] = { confidence: 0, success: 0 };
        stats[m.resourceId].confidence += (m.confidenceScore || 0);
        stats[m.resourceId].success += (m.successCount || 0);
      });
      setAnalytics(stats);
    });
  }, []);


  const uniqueResources = useMemo(() => {
    const map = new Map<string, { base: Resource, uses: { topic: string, course: string, role?: string }[] }>();
    
    for (const r of resources) {
      if (!r.url) continue;
      const canonicalUrl = r.url;
      if (!map.has(canonicalUrl)) {
        map.set(canonicalUrl, { base: r, uses: [] });
      }
      
      const topic = topics.find(t => t.id === r.topicId);
      const course = courses.find(c => c.id === topic?.courseId);
      
      const resId = 'res_' + btoa(canonicalUrl).replace(/[^a-zA-Z0-9]/g, "").substring(0, 16);
      map.get(canonicalUrl)!.base.resourceId = resId;
      map.get(canonicalUrl)!.uses.push({
        topic: topic?.name || 'Unknown Topic',
        course: course?.name || 'Unknown Course',
        role: r.scopeInstructions
      });
    }
    
    return Array.from(map.values());
  }, [resources, topics, courses]);

  const filteredResources = uniqueResources.filter(({ base }) => {
    const matchesSearch = base.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (base.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || base.type === filterType;
    return matchesSearch && matchesType;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-5 h-5 text-red-500" />;
      case 'pdf': return <FileText className="w-5 h-5 text-red-400" />;
      case 'textbook': return <BookOpen className="w-5 h-5 text-emerald-600" />;
      case 'article': return <Globe className="w-5 h-5 text-blue-500" />;
      case 'link': return <LinkIcon className="w-5 h-5 text-slate-500" />;
      default: return <File className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
          <Library className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">My Resources</h1>
          <p className="text-slate-500 dark:text-slate-400">Your consolidated library of {uniqueResources.length} unique resources across all programs.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          <option value="all">All Types</option>
          <option value="video">Videos</option>
          <option value="pdf">PDFs</option>
          <option value="article">Articles</option>
          <option value="textbook">Textbooks</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResources.map(({ base, uses }, i) => (
          <div key={i} className="flex flex-col bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 mb-3">
              <div className="mt-1">{getIcon(base.type)}</div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-2" title={base.title}>
                  {base.title}
                </h3>
                {analytics[base.resourceId] && analytics[base.resourceId].confidence > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full w-max text-[10px] font-bold">
                    <Star className="w-3 h-3 fill-current" />
                    {analytics[base.resourceId].confidence} Effectiveness Score
                  </div>
                )}
                <a href={base.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all line-clamp-1 mt-1">
                  {base.url.length > 50 ? base.url.substring(0, 50) + '...' : base.url}
                </a>
              </div>
            </div>
            
            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Used in {uses.length} topic{uses.length > 1 ? 's' : ''}</p>
              <div className="space-y-2 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
                {uses.map((use, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded text-xs flex flex-col gap-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{use.topic}</span>
                    <span className="text-slate-500 truncate">{use.course}</span>
                    {use.role && (
                      <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px] w-max font-medium mt-1">
                        {use.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {filteredResources.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            No resources found matching your filters.
          </div>
        )}
      </div>
    </div>
  );
}
