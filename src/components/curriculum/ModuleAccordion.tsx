'use client';

import { Module, Topic } from '@/types/curriculum';
import { ChevronDown, ChevronRight, Plus, Trash2, ExternalLink, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import TopicRow from '@/components/curriculum/TopicRow';
import { Button } from '@/components/ui/Button';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import React from 'react';

interface ModuleAccordionProps {
  module: Module;
  topics: Topic[];
  isExpanded: boolean;
  onToggle: () => void;
  isLocked?: boolean;
  isEditMode?: boolean;
  onAddTopic?: (moduleId: string) => void;
}

export default function ModuleAccordion({ module, topics, isExpanded, onToggle, isLocked = false, isEditMode = false, onAddTopic }: ModuleAccordionProps) {
  const deleteModule = useCurriculumStore(state => state.deleteModule);
  const allProjects = useCurriculumStore(state => state.projects);
  const projects = React.useMemo(() => allProjects.filter(p => p.moduleId === module.id).sort((a,b) => a.order - b.order), [allProjects, module.id]);
  
  const completedTopics = topics.filter(t => t.status === 'completed').length;
  const progress = topics.length > 0 ? (completedTopics / topics.length) * 100 : 0;

  return (
    <div className={`border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 mb-4 shadow-sm transition-all ${(isLocked && !isEditMode) ? 'opacity-50 grayscale select-none' : ''}`}>
      <div 
        className={`flex items-center p-4 transition-colors ${(isLocked && !isEditMode) ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
        onClick={() => { if (!(isLocked && !isEditMode)) onToggle(); }}
      >
        <div className="text-slate-400 mr-3">
          {(isLocked && !isEditMode) ? <Lock className="w-5 h-5 text-slate-400" /> : (isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />)}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-semibold text-lg text-slate-900 dark:text-white">{module.name}</h3>
            <Badge variant="default">{topics.length} topics</Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{module.description}</p>
        </div>

        <div className="flex items-center gap-6 ml-4">
          <div className="w-32 hidden sm:block">
            <div className="flex justify-between text-xs mb-1 text-slate-500">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <ProgressBar value={progress} color="#0ea5e9" />
          </div>
          {isEditMode && (
            <button 
              onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete module?')) deleteModule(module.id); }}
              className="text-slate-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {module.notebookUrl && (
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-blue-500" />
                  Module NotebookLM Companion
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Review your notes, podcasts, and study guides for this module.</p>
              </div>
              <Button 
                onClick={() => window.open(module.notebookUrl, '_blank', 'noopener noreferrer')}
                size="sm"
                variant="secondary"
                className="shrink-0 border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              >
                Open NotebookLM Hub <ExternalLink className="w-3 h-3 ml-1.5" />
              </Button>
            </div>
          )}
          
          {projects.length > 0 && (
            <div className="bg-violet-50/50 dark:bg-violet-900/10 p-4 border-b border-violet-100 dark:border-violet-900/20">
              <h4 className="font-semibold text-violet-900 dark:text-violet-100 text-sm mb-3">Module Projects</h4>
              <div className="space-y-3">
                {projects.map(project => (
                  <div key={project.id} className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-violet-200 dark:border-violet-800/50 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-bold text-slate-900 dark:text-white flex-1">{project.title}</h5>
                      <div className="flex items-center gap-2">
                        {project.difficulty && <Badge className="capitalize text-[10px] py-0 bg-slate-100 text-slate-600">{project.difficulty}</Badge>}
                        {project.type && <Badge className="capitalize text-[10px] py-0 bg-violet-100 text-violet-700 border-violet-200">{project.type.replace('-', ' ')}</Badge>}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{project.description}</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {project.requirements && project.requirements.length > 0 && (
                        <div>
                          <h6 className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider mb-2">Requirements</h6>
                          <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400 text-xs">
                            {project.requirements.map((req, i) => <li key={i}>{req}</li>)}
                          </ul>
                        </div>
                      )}
                      {project.deliverables && project.deliverables.length > 0 && (
                        <div>
                          <h6 className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider mb-2">Deliverables</h6>
                          <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400 text-xs">
                            {project.deliverables.map((del, i) => <li key={i}>{del}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            {topics.length === 0 ? (
              <div className="p-6 text-center text-slate-500">No topics in this module yet.</div>
            ) : (
              topics.sort((a,b) => a.order - b.order).map((topic, index, sortedTopics) => {
                let isTopicLocked = false;
                if (!isEditMode && index > 0) {
                  isTopicLocked = !sortedTopics[index - 1].isCompleted;
                }
                return <TopicRow key={topic.id} topic={topic} isLocked={isTopicLocked} isEditMode={isEditMode} />;
              })
            )}
          </div>
          {isEditMode && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/50">
              <Button variant="ghost" className="w-full justify-start text-slate-500 hover:text-violet-600 dark:hover:text-violet-400" onClick={(e) => { e.stopPropagation(); onAddTopic?.(module.id); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Topic
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
