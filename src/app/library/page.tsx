'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { 
  Library, 
  Search, 
  FileText, 
  Video, 
  BookOpen, 
  Globe, 
  Link as LinkIcon, 
  File, 
  Star, 
  Share2, 
  Sparkles, 
  Download,
  ShieldCheck,
  Check,
  Send,
  Loader2
} from 'lucide-react';
import { Resource, ResourceMapping } from '@/types/curriculum';
import { db } from '@/lib/db';
import { 
  sanitizeResourceForCommunity, 
  generateCommunityResourceManifest, 
  downloadJsonFile, 
  publishToCommunityOneTap,
  CommunityResourcePayload 
} from '@/lib/community';
import { PublishResourceModal } from '@/components/community/PublishResourceModal';
import { CommunityResourceBrowserModal } from '@/components/community/CommunityResourceBrowserModal';

export default function LibraryPage() {
  const resources = useCurriculumStore(state => state.resources);
  const topics = useCurriculumStore(state => state.topics);
  const courses = useCurriculumStore(state => state.courses);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [analytics, setAnalytics] = useState<Record<string, { confidence: number, success: number }>>({});
  const [mappingsList, setMappingsList] = useState<ResourceMapping[]>([]);
  const [templatesMap, setTemplatesMap] = useState<Map<string, string>>(new Map());

  // Community modals & 1-tap state
  const [publishPayload, setPublishPayload] = useState<CommunityResourcePayload | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isBrowserModalOpen, setIsBrowserModalOpen] = useState(false);
  const [isExportingManifest, setIsExportingManifest] = useState(false);
  const [manifestSuccess, setManifestSuccess] = useState(false);
  const [isOneTapPublishingAll, setIsOneTapPublishingAll] = useState(false);
  const [oneTapFeedback, setOneTapFeedback] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      db.resourceMappings.toArray(),
      db.resourceTemplates.toArray()
    ]).then(([mappings, templates]) => {
      setMappingsList(mappings);
      
      const tMap = new Map<string, string>();
      templates.forEach(t => {
        if (t.canonicalUrl) tMap.set(t.canonicalUrl, t.id);
      });
      setTemplatesMap(tMap);

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
        map.set(canonicalUrl, { base: { ...r }, uses: [] });
      }
      
      const topic = topics.find(t => t.id === r.topicId);
      const course = courses.find(c => c.id === topic?.courseId);
      
      const realId = templatesMap.get(canonicalUrl) || r.id;
      map.get(canonicalUrl)!.base.resourceId = realId;
      map.get(canonicalUrl)!.uses.push({
        topic: topic?.name || 'Unknown Topic',
        course: course?.name || 'Unknown Course',
        role: r.scopeInstructions
      });
    }
    
    return Array.from(map.values());
  }, [resources, topics, courses, templatesMap]);

  const filteredResources = uniqueResources.filter(({ base }) => {
    const matchesSearch = base.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (base.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || base.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleShareToCommunity = async (base: Resource, uses: { topic: string }[]) => {
    const mapping = mappingsList.find(m => m.resourceId === base.resourceId);
    const relatedTopicNames = uses.map(u => u.topic);
    try {
      const payload = await sanitizeResourceForCommunity(base, mapping, relatedTopicNames);
      setPublishPayload(payload);
      setIsPublishModalOpen(true);
    } catch (err: any) {
      alert(`Sanitization error: ${err.message}`);
    }
  };

  const handleOneTapPublishAll = async () => {
    try {
      setIsOneTapPublishingAll(true);
      const manifest = await generateCommunityResourceManifest();
      const res = await publishToCommunityOneTap(manifest, 'Full Resource Catalog');
      setOneTapFeedback(res.message);
      setTimeout(() => setOneTapFeedback(null), 5000);
    } catch (err: any) {
      alert(`1-Tap Publish error: ${err.message}`);
    } finally {
      setIsOneTapPublishingAll(false);
    }
  };

  const handleOneTapShareSingle = async (base: Resource, uses: { topic: string }[]) => {
    const mapping = mappingsList.find(m => m.resourceId === base.resourceId);
    const relatedTopicNames = uses.map(u => u.topic);
    try {
      const payload = await sanitizeResourceForCommunity(base, mapping, relatedTopicNames);
      const res = await publishToCommunityOneTap(payload, base.title);
      setOneTapFeedback(`"${base.title}": ${res.message}`);
      setTimeout(() => setOneTapFeedback(null), 5000);
    } catch (err: any) {
      alert(`1-Tap Share error: ${err.message}`);
    }
  };

  const handleExportManifest = async () => {
    try {
      setIsExportingManifest(true);
      const manifest = await generateCommunityResourceManifest();
      downloadJsonFile(manifest, `degreetrack_community_manifest_${new Date().toISOString().slice(0, 10)}.json`);
      setManifestSuccess(true);
      setTimeout(() => setManifestSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to export manifest: ${err.message}`);
    } finally {
      setIsExportingManifest(false);
    }
  };

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
      {/* 1-Tap Feedback Alert */}
      {oneTapFeedback && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-medium text-emerald-900 dark:text-emerald-200 shadow-sm animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{oneTapFeedback}</span>
        </div>
      )}

      {/* Header with Community Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">My Resources</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Consolidated library of {uniqueResources.length} unique resources across all programs.
            </p>
          </div>
        </div>

        {/* Community Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBrowserModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
            <span>Community Hub</span>
          </button>

          <button
            onClick={handleOneTapPublishAll}
            disabled={isOneTapPublishingAll || uniqueResources.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="1-Tap export and publish all resources to community"
          >
            {isOneTapPublishingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{isOneTapPublishingAll ? 'Publishing...' : '1-Tap Publish All'}</span>
          </button>

          <button
            onClick={handleExportManifest}
            disabled={isExportingManifest || uniqueResources.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50"
            title="Export full community resource manifest (100% sanitized)"
          >
            {manifestSuccess ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Download className="w-3.5 h-3.5" />}
            <span>{manifestSuccess ? 'Exported!' : 'Manifest'}</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 text-sm"
          />
        </div>
        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200"
        >
          <option value="all">All Types</option>
          <option value="video">Videos</option>
          <option value="pdf">PDFs</option>
          <option value="article">Articles</option>
          <option value="textbook">Textbooks</option>
        </select>
      </div>

      {/* Resource Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResources.map(({ base, uses }, i) => {
          const confidence = analytics[base.resourceId]?.confidence || 0;
          return (
            <div key={i} className="flex flex-col bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="mt-1">{getIcon(base.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 text-sm" title={base.title}>
                      {base.title}
                    </h3>
                  </div>

                  {confidence > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full w-max text-[10px] font-bold border border-amber-200 dark:border-amber-800/40">
                      <Star className="w-3 h-3 fill-current" />
                      {confidence} Effectiveness Score
                    </div>
                  )}

                  <a href={base.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all line-clamp-1 mt-1">
                    {base.url.length > 45 ? base.url.substring(0, 45) + '...' : base.url}
                  </a>
                </div>
              </div>
              
              {/* Uses list */}
              <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Used in {uses.length} topic{uses.length > 1 ? 's' : ''}
                  </p>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOneTapShareSingle(base, uses)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors px-2 py-0.5 rounded-lg bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/40 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800/40"
                      title="1-Tap export this resource to community"
                    >
                      <Send className="w-2.5 h-2.5" />
                      <span>1-Tap</span>
                    </button>
                    <button
                      onClick={() => handleShareToCommunity(base, uses)}
                      className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50"
                      title="Preview sanitized community manifest"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[85px] overflow-y-auto pr-1 custom-scrollbar">
                  {uses.map((use, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded text-xs flex flex-col gap-0.5">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{use.topic}</span>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="truncate">{use.course}</span>
                        {use.role && (
                          <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium">
                            {use.role}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {filteredResources.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            No resources found matching your filters.
          </div>
        )}
      </div>

      {/* Modals */}
      <PublishResourceModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        payload={publishPayload}
      />

      <CommunityResourceBrowserModal
        isOpen={isBrowserModalOpen}
        onClose={() => setIsBrowserModalOpen(false)}
      />
    </div>
  );
}
