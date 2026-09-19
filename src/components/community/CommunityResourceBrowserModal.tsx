'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { 
  Users, 
  Star, 
  Search, 
  Plus, 
  Check, 
  ExternalLink, 
  Video, 
  FileText, 
  BookOpen, 
  Globe, 
  Sparkles,
  Filter,
  Upload,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface CommunityResourceBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommunityFeaturedResource {
  id: string;
  title: string;
  url: string;
  type: 'video' | 'article' | 'textbook' | 'pdf';
  role: string;
  category: string;
  description: string;
}

// Curated high-confidence educational recommendations
const FEATURED_COMMUNITY_RESOURCES: CommunityFeaturedResource[] = [
  {
    id: 'comm_3b1b_linear_algebra',
    title: 'Essence of Linear Algebra — 3Blue1Brown',
    url: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab',
    type: 'video',
    role: 'VISUAL',
    category: 'Mathematics & AI',
    description: 'A geometric, intuitive foundation for vectors, matrices, determinants, and eigenvectors.'
  },
  {
    id: 'comm_mit_algorithms',
    title: 'Introduction to Algorithms (SMA 5503) — MIT OCW',
    url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/',
    type: 'video',
    role: 'PRIMARY',
    category: 'Computer Science',
    description: 'Complete rigorous course on sorting, trees, hashing, dynamic programming, and graphs.'
  },
  {
    id: 'comm_karpathy_nn',
    title: 'Neural Networks: Zero to Hero — Andrej Karpathy',
    url: 'https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ',
    type: 'video',
    role: 'PRIMARY',
    category: 'Machine Learning',
    description: 'Building micrograd, makemore, and GPT from scratch with deep backpropagation derivations.'
  },
  {
    id: 'comm_crafting_interpreters',
    title: 'Crafting Interpreters — Robert Nystrom',
    url: 'https://craftinginterpreters.com/',
    type: 'textbook',
    role: 'PRACTICE',
    category: 'Software Engineering',
    description: 'Handbook on compiler design, scanning, parsing, ASTs, bytecode, and virtual machines.'
  },
  {
    id: 'comm_stanford_cs229',
    title: 'Machine Learning Course Notes — Stanford CS229',
    url: 'https://cs229.stanford.edu/main_notes.pdf',
    type: 'pdf',
    role: 'REFERENCE',
    category: 'Machine Learning',
    description: 'Concise mathematical derivations of supervised and unsupervised learning algorithms.'
  }
];

export function CommunityResourceBrowserModal({ isOpen, onClose }: CommunityResourceBrowserModalProps) {
  const { courses, topics, addResource } = useCurriculumStore();
  const [resources, setResources] = useState<CommunityFeaturedResource[]>(FEATURED_COMMUNITY_RESOURCES);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const MANIFEST_URL = 'https://raw.githubusercontent.com/pandeysuryansh921-wq/course-tracker-library/main/community/manifest.json';
  const RESOURCES_INDEX_URL = 'https://raw.githubusercontent.com/pandeysuryansh921-wq/course-tracker-library/main/community/resources/index.json';
  const FALLBACK_RESOURCES_URL = 'https://raw.githubusercontent.com/pandeysuryansh921-wq/course-tracker-library/main/resources.json';

  const fetchLiveCommunity = async (forceRefresh: boolean = false) => {
    try {
      setIsLoadingLive(true);

      // Check cached version
      const cachedVersion = localStorage.getItem('degreetrack_resources_version');
      const cachedData = localStorage.getItem('degreetrack_resources_cache');

      if (!forceRefresh && cachedVersion && cachedData) {
        try {
          const mRes = await fetch(`${MANIFEST_URL}?t=${Date.now()}`);
          if (mRes.ok) {
            const m = await mRes.json();
            if (m.libraryVersion === Number(cachedVersion)) {
              setResources(JSON.parse(cachedData));
              setIsLoadingLive(false);
              return;
            }
          }
        } catch {
          // Fall through to live fetch
        }
      }

      let res = await fetch(`${RESOURCES_INDEX_URL}?t=${Date.now()}`);
      if (!res.ok) {
        res = await fetch(`${FALLBACK_RESOURCES_URL}?t=${Date.now()}`);
      }

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const parsed: CommunityFeaturedResource[] = data.map((item: any, idx: number) => {
            if (item.version === 'degreetrack.community.v1' && item.resource) {
              return {
                id: `comm_live_${idx}_${item.resource.canonicalUrl?.slice(-8) || idx}`,
                title: item.resource.title,
                url: item.resource.canonicalUrl,
                type: (item.resource.type?.toLowerCase() || 'article') as any,
                role: item.resource.role || 'PRIMARY',
                category: item.context?.topics?.[0] || 'Community',
                description: item.resource.description || `Community resource with confidence ${item.metrics?.confidenceScore || 0}`
              };
            }
            return item;
          }).filter((r: any) => r && r.url && (r.url.startsWith('http://') || r.url.startsWith('https://')));

          const existingUrls = new Set(FEATURED_COMMUNITY_RESOURCES.map(r => r.url));
          const fresh = parsed.filter(p => !existingUrls.has(p.url));
          const merged = [...FEATURED_COMMUNITY_RESOURCES, ...fresh];
          setResources(merged);

          localStorage.setItem('degreetrack_resources_cache', JSON.stringify(merged));
          try {
            const mRes = await fetch(`${MANIFEST_URL}?t=${Date.now()}`);
            if (mRes.ok) {
              const m = await mRes.json();
              localStorage.setItem('degreetrack_resources_version', String(m.libraryVersion || 1));
            }
          } catch {}
        }
      }
    } catch {
      // Fallback silently to curated resources
    } finally {
      setIsLoadingLive(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    fetchLiveCommunity(false);
  }, [isOpen]);

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const itemsToAdd: CommunityFeaturedResource[] = [];

      const processItem = (item: any, idx: number) => {
        if (item.version === 'degreetrack.community.v1' && item.resource) {
          itemsToAdd.push({
            id: `comm_import_${Date.now()}_${idx}`,
            title: item.resource.title,
            url: item.resource.canonicalUrl,
            type: (item.resource.type?.toLowerCase() || 'article') as any,
            role: item.resource.role || 'PRIMARY',
            category: item.context?.topics?.[0] || 'Imported',
            description: item.resource.description || 'Imported community resource'
          });
        } else if (item.url && item.title) {
          itemsToAdd.push({
            id: `comm_import_${Date.now()}_${idx}`,
            title: item.title,
            url: item.url,
            type: (item.type?.toLowerCase() || 'article') as any,
            role: item.role || 'PRIMARY',
            category: item.category || 'Imported',
            description: item.description || 'Imported community resource'
          });
        }
      };

      if (parsed.version === 'degreetrack.community.v1' && Array.isArray(parsed.resources)) {
        parsed.resources.forEach((r: any, i: number) => processItem(r, i));
      } else if (Array.isArray(parsed)) {
        parsed.forEach((r: any, i: number) => processItem(r, i));
      } else {
        processItem(parsed, 0);
      }

      if (itemsToAdd.length === 0) {
        setImportStatus("No valid resources found in file.");
      } else {
        setResources(prev => {
          const urls = new Set(prev.map(p => p.url));
          const unique = itemsToAdd.filter(it => !urls.has(it.url));
          return [...unique, ...prev];
        });
        setImportStatus(`Imported ${itemsToAdd.length} resource(s) from file!`);
      }
      setTimeout(() => setImportStatus(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setImportStatus(`Invalid JSON file: ${err.message}`);
      setTimeout(() => setImportStatus(null), 4000);
    }
  };

  const categories = ['All', 'Machine Learning', 'Mathematics & AI', 'Computer Science', 'Software Engineering', 'Community', 'Imported'];

  const filtered = resources.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                          item.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleAddResource = async (res: CommunityFeaturedResource) => {
    if (!selectedTopicId) return;
    try {
      await addResource(selectedTopicId, res.title, res.url, res.type, res.role);
      setAddedMap(prev => ({ ...prev, [res.id]: true }));
      setTimeout(() => {
        setAddedMap(prev => ({ ...prev, [res.id]: false }));
      }, 3000);
    } catch (err) {
      console.error('Failed to add resource:', err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4 text-red-500" />;
      case 'pdf': return <FileText className="w-4 h-4 text-rose-500" />;
      case 'textbook': return <BookOpen className="w-4 h-4 text-emerald-600" />;
      default: return <Globe className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Community Resource Hub">
      <div className="flex flex-col gap-5">
        {/* Banner */}
        <div className="flex items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border border-violet-200 dark:border-violet-800/40 rounded-xl">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0" />
            <div className="text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold block text-slate-900 dark:text-slate-100">
                Crowd-Sourced Intelligence & Resource Confidence
              </span>
              Explore high-effectiveness materials tested and rated by learners across the DegreeTrack ecosystem.
            </div>
          </div>
          
          <div>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept=".json" 
              className="hidden" 
              onChange={handleImportJsonFile} 
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fetchLiveCommunity(true)}
                disabled={isLoadingLive}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium whitespace-nowrap shadow-sm transition-colors"
                title="Refresh community resources"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLive ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium whitespace-nowrap shadow-sm transition-colors"
                title="Import resources from a community .json payload file"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON</span>
              </button>
            </div>
          </div>
        </div>

        {importStatus && (
          <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{importStatus}</span>
          </div>
        )}

        {/* Filter and Search */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search community resources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Target Topic Selection for Instant Adding */}
        {topics.length > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Add directly to a topic in your curriculum:
            </span>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 max-w-[260px]"
            >
              <option value="">Select destination topic...</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Resources List */}
        <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
          {filtered.map(item => (
            <div 
              key={item.id}
              className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/70 hover:border-blue-400/50 transition-colors flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">{getIcon(item.type)}</div>
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 border border-violet-200 dark:border-violet-800/40">
                  <Sparkles className="w-3 h-3" />
                  <span>Curated</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/40 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px] font-semibold">
                    {item.role}
                  </span>
                  <span className="text-slate-400 text-[11px]">{item.category}</span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors p-1"
                    title="Open Link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {selectedTopicId && (
                    <button
                      onClick={() => handleAddResource(item)}
                      disabled={addedMap[item.id]}
                      className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      {addedMap[item.id] ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {addedMap[item.id] ? 'Added!' : 'Add to Topic'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              No community resources found matching your search.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
