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
  Filter
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
  communityRating: number;
  communityVotes: number;
  description: string;
}

// Curated high-confidence community resource recommendations
const FEATURED_COMMUNITY_RESOURCES: CommunityFeaturedResource[] = [
  {
    id: 'comm_3b1b_linear_algebra',
    title: 'Essence of Linear Algebra — 3Blue1Brown',
    url: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab',
    type: 'video',
    role: 'VISUAL',
    category: 'Mathematics & AI',
    communityRating: 4.9,
    communityVotes: 320,
    description: 'A geometric, intuitive foundation for vectors, matrices, determinants, and eigenvectors.'
  },
  {
    id: 'comm_mit_algorithms',
    title: 'Introduction to Algorithms (SMA 5503) — MIT OCW',
    url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/',
    type: 'video',
    role: 'PRIMARY',
    category: 'Computer Science',
    communityRating: 4.8,
    communityVotes: 245,
    description: 'Complete rigorous course on sorting, trees, hashing, dynamic programming, and graphs.'
  },
  {
    id: 'comm_karpathy_nn',
    title: 'Neural Networks: Zero to Hero — Andrej Karpathy',
    url: 'https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ',
    type: 'video',
    role: 'PRIMARY',
    category: 'Machine Learning',
    communityRating: 5.0,
    communityVotes: 512,
    description: 'Building micrograd, makemore, and GPT from scratch with deep backpropagation derivations.'
  },
  {
    id: 'comm_crafting_interpreters',
    title: 'Crafting Interpreters — Robert Nystrom',
    url: 'https://craftinginterpreters.com/',
    type: 'textbook',
    role: 'PRACTICE',
    category: 'Software Engineering',
    communityRating: 4.9,
    communityVotes: 188,
    description: 'Handbook on compiler design, scanning, parsing, ASTs, bytecode, and virtual machines.'
  },
  {
    id: 'comm_stanford_cs229',
    title: 'Machine Learning Course Notes — Stanford CS229',
    url: 'https://cs229.stanford.edu/main_notes.pdf',
    type: 'pdf',
    role: 'REFERENCE',
    category: 'Machine Learning',
    communityRating: 4.7,
    communityVotes: 142,
    description: 'Concise mathematical derivations of supervised and unsupervised learning algorithms.'
  }
];

export function CommunityResourceBrowserModal({ isOpen, onClose }: CommunityResourceBrowserModalProps) {
  const { courses, topics, addResource } = useCurriculumStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});

  const categories = ['All', 'Machine Learning', 'Mathematics & AI', 'Computer Science', 'Software Engineering'];

  const filtered = FEATURED_COMMUNITY_RESOURCES.filter(item => {
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
        <div className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border border-violet-200 dark:border-violet-800/40 rounded-xl">
          <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0" />
          <div className="text-xs text-slate-700 dark:text-slate-300">
            <span className="font-semibold block text-slate-900 dark:text-slate-100">
              Crowd-Sourced Intelligence & Resource Confidence
            </span>
            Explore high-effectiveness materials tested and rated by learners across the DegreeTrack ecosystem.
          </div>
        </div>

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

                <div className="flex items-center gap-1 text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full text-xs font-bold shrink-0">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>{item.communityRating}</span>
                  <span className="text-[10px] text-slate-400 font-normal">({item.communityVotes})</span>
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
