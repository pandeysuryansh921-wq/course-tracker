'use client';

import React, { useState } from 'react';
import { Topic, Resource, FileAttachmentType, AssignmentFile } from '@/types/curriculum';
import { ChevronDown, ChevronRight, Trash2, Plus, Lock, ExternalLink, FileText, CheckCircle, Clock } from 'lucide-react';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { getStatusBg, getStatusLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import ResourceLink from '@/components/curriculum/ResourceLink';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { generateId } from '@/lib/utils';

interface TopicRowProps {
  topic: Topic;
  isLocked?: boolean;
  isEditMode?: boolean;
}

export default function TopicRow({ topic, isLocked = false, isEditMode = false }: TopicRowProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isAddingResource, setIsAddingResource] = React.useState(false);
  const [resourceSource, setResourceSource] = React.useState<'link' | 'upload'>('link');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [newResource, setNewResource] = React.useState({ title: '', url: '', type: 'other' });
  const [scoreInput, setScoreInput] = React.useState('');
  
  const [isAddingAssignment, setIsAddingAssignment] = React.useState(false);
  const [assignmentSource, setAssignmentSource] = React.useState<'link' | 'upload'>('link');
  const [newAssignmentTitle, setNewAssignmentTitle] = React.useState('');
  const [newAssignmentLink, setNewAssignmentLink] = React.useState('');
  const [newAssignmentFile, setNewAssignmentFile] = React.useState<File | null>(null);

  const [submissionSource, setSubmissionSource] = React.useState<Record<string, 'link' | 'upload'>>({});
  const [submissionLinks, setSubmissionLinks] = React.useState<Record<string, string>>({});
  const [submissionFiles, setSubmissionFiles] = React.useState<Record<string, File | null>>({});

  const allResources = useCurriculumStore(state => state.resources);
  const updateTopicStatus = useCurriculumStore(state => state.updateTopicStatus);
  const toggleTopicCompletion = useCurriculumStore(state => state.toggleTopicCompletion);
  const updateTopic = useCurriculumStore(state => state.updateTopic);
  const deleteTopic = useCurriculumStore(state => state.deleteTopic);
  const addResource = useCurriculumStore(state => state.addResource);
  const submitTopicScore = useCurriculumStore(state => state.submitTopicScore);
  const addAssignment = useCurriculumStore(state => state.addAssignment);
  const updateAssignment = useCurriculumStore(state => state.updateAssignment);
  const deleteAssignment = useCurriculumStore(state => state.deleteAssignment);

  const resources = React.useMemo(
    () => allResources.filter(r => r.topicId === topic.id),
    [allResources, topic.id]
  );

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateTopicStatus(topic.id, e.target.value as Topic['status']);
  };

  const handleToggleComplete = (e: React.ChangeEvent<HTMLInputElement>) => {
    toggleTopicCompletion(topic.id, e.target.checked);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      let type: Resource['type'] = 'other';
      if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('image/')) type = 'photo';
      else if (file.type === 'application/pdf') type = 'pdf';
      setNewResource(prev => ({ ...prev, title: file.name, type }));
    }
  };

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResource.title) return;
    
    if (resourceSource === 'link') {
      if (!newResource.url) return;
      addResource(topic.id, newResource.title, newResource.url, newResource.type as Resource['type']);
      setNewResource({ title: '', url: '', type: 'other' });
      setIsAddingResource(false);
    } else {
      if (!selectedFile) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        addResource(topic.id, newResource.title, base64String, newResource.type as Resource['type']);
        setNewResource({ title: '', url: '', type: 'other' });
        setSelectedFile(null);
        setIsAddingResource(false);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleScoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const score = parseInt(scoreInput);
    if (!isNaN(score) && score >= 0) {
      submitTopicScore(topic.id, score);
      setScoreInput('');
    }
  };

  const handleAssignmentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewAssignmentFile(e.target.files[0]);
    }
  };

  const resetAssignmentForm = () => {
    setNewAssignmentTitle('');
    setNewAssignmentLink('');
    setNewAssignmentFile(null);
    setIsAddingAssignment(false);
  };

  const handleAddAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignmentTitle.trim()) return;

    if (assignmentSource === 'upload' && newAssignmentFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        
        let type: FileAttachmentType = 'document';
        if (newAssignmentFile.type.startsWith('image/')) type = 'image';
        else if (newAssignmentFile.type === 'application/pdf') type = 'pdf';

        addAssignment(topic.id, {
          title: newAssignmentTitle,
          isSubmitted: false,
          file: {
            id: generateId(),
            name: newAssignmentFile.name,
            type,
            url: base64String
          }
        });
        resetAssignmentForm();
      };
      reader.readAsDataURL(newAssignmentFile);
    } else {
      addAssignment(topic.id, {
        title: newAssignmentTitle,
        isSubmitted: false,
        file: newAssignmentLink ? {
          id: generateId(),
          name: newAssignmentLink,
          type: 'link',
          url: newAssignmentLink
        } : undefined
      });
      resetAssignmentForm();
    }
  };

  const handleSubmissionFileChange = (assignmentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSubmissionFiles(prev => ({ ...prev, [assignmentId]: e.target.files![0] }));
    }
  };

  const handleAssignmentSubmit = (assignmentId: string, e: React.FormEvent) => {
    e.preventDefault();
    
    const source = submissionSource[assignmentId] || 'link';
    
    if (source === 'upload') {
      const file = submissionFiles[assignmentId];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        let type: FileAttachmentType = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type === 'application/pdf') type = 'pdf';

        updateAssignment(topic.id, assignmentId, {
          isSubmitted: true,
          submittedAt: new Date().toISOString(),
          submissionFile: {
            id: generateId(),
            name: file.name,
            type,
            url: base64String
          }
        });
        
        setSubmissionFiles(prev => { const next = {...prev}; delete next[assignmentId]; return next; });
      };
      reader.readAsDataURL(file);
    } else {
      const linkUrl = submissionLinks[assignmentId];
      if (!linkUrl) return;
      
      updateAssignment(topic.id, assignmentId, {
        isSubmitted: true,
        submittedAt: new Date().toISOString(),
        submissionFile: {
          id: generateId(),
          name: linkUrl,
          type: 'link',
          url: linkUrl
        }
      });
      setSubmissionLinks(prev => { const next = {...prev}; delete next[assignmentId]; return next; });
    }
  };

  return (
    <div className={`border-b border-slate-200 dark:border-slate-800 last:border-0 transition-all ${(isLocked && !isEditMode) ? 'opacity-50 select-none grayscale bg-slate-50/50 dark:bg-slate-900/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
      <div 
        className={`flex flex-col sm:flex-row sm:items-center p-4 gap-4 ${(isLocked && !isEditMode) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => { if (!(isLocked && !isEditMode)) setIsExpanded(!isExpanded); }}
      >
        <div className="flex-1 flex flex-wrap items-center gap-3">
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 mr-1" disabled={isLocked && !isEditMode}>
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          
          <input 
            type="checkbox" 
            checked={topic.isCompleted} 
            onChange={handleToggleComplete}
            onClick={(e) => e.stopPropagation()}
            disabled={isLocked && !isEditMode}
            className="w-5 h-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
          />
          {topic.isMastered ? (
            <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/20 shrink-0">Mastered 🌟</Badge>
          ) : topic.isCompleted ? (
            <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/20 shrink-0">Completed ✅</Badge>
          ) : topic.status === 'needs-review' ? (
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/20 shrink-0">Needs Review 🔄</Badge>
          ) : (
            <Badge className={`${getStatusBg(topic.status)} shrink-0`}>{getStatusLabel(topic.status)}</Badge>
          )}
          <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
            {(isLocked && !isEditMode) && <Lock className="w-4 h-4 text-slate-400 shrink-0" />}
            {topic.name}
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 sm:justify-end ml-10 sm:ml-0">
          <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">{resources.length} resources</span>
          {isEditMode && (
            <>
              <select 
                value={topic.status} 
                onChange={handleStatusChange}
                onClick={(e) => e.stopPropagation()}
                disabled={isLocked && !isEditMode}
                className="w-36 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              >
                <option value="not-started">Not Started</option>
                <option value="in-progress">In Progress</option>
                <option value="needs-review">Needs Review</option>
                <option value="completed">Completed</option>
              </select>
              <button 
                onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete topic?')) deleteTopic(topic.id); }}
                className="text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-12 pb-4 pt-2">
          {/* Quiz Section */}
          <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              Topic Quiz
              {topic.quizScore !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${topic.isMastered ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                  Score: {topic.quizScore} / {topic.quizMaxScore || 100} ({(topic.quizScore / (topic.quizMaxScore || 100) * 100).toFixed(0)}%)
                </span>
              )}
            </h4>
            
            {isEditMode ? (
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">External Quiz Link (Google Forms, Quizlet, etc.)</label>
                  <Input 
                    value={topic.quizUrl || ''} 
                    onChange={(e) => updateTopic(topic.id, { quizUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full text-sm"
                  />
                </div>
                <div className="w-full sm:w-1/3 space-y-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Max Score</label>
                  <Input 
                    type="number"
                    min="1"
                    value={topic.quizMaxScore || 100} 
                    onChange={(e) => updateTopic(topic.id, { quizMaxScore: Number(e.target.value) || 100 })}
                    className="w-full text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {topic.quizUrl ? (
                  <a 
                    href={topic.quizUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Take Topic Quiz <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <span className="text-sm text-slate-500 italic">No quiz available for this topic.</span>
                )}
                
                <form onSubmit={handleScoreSubmit} className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Earned"
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      className="w-24 text-sm"
                      required
                    />
                    <span className="text-slate-500 font-medium">/ {topic.quizMaxScore || 100}</span>
                  </div>
                  <Button type="submit" size="sm" variant="secondary" disabled={!scoreInput}>
                    Submit Score
                  </Button>
                </form>
              </div>
            )}
            
            {topic.status === 'needs-review' && !isEditMode && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                Minimum passing score is 70%. Review the material and try again.
              </p>
            )}
          </div>

          {/* Assignments Section */}
          <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                Assignments
              </h4>
              {isEditMode && (
                <Button variant="secondary" size="sm" onClick={() => setIsAddingAssignment(true)} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-1" /> Add Assignment
                </Button>
              )}
            </div>

            {isAddingAssignment && isEditMode && (
              <div className="mb-4 bg-white dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-700">
                <div className="flex gap-4 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <button 
                    type="button"
                    onClick={() => setAssignmentSource('link')}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${assignmentSource === 'link' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Add Link
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAssignmentSource('upload')}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${assignmentSource === 'upload' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Attach File
                  </button>
                </div>
                <form onSubmit={handleAddAssignment} className="flex flex-col gap-3">
                  <Input
                    placeholder="Assignment Title"
                    value={newAssignmentTitle}
                    onChange={(e) => setNewAssignmentTitle(e.target.value)}
                    className="w-full text-sm"
                    required
                  />
                  
                  {assignmentSource === 'upload' && (
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">PDF, PNG, JPG, DOC, DOCX</p>
                          {newAssignmentFile && <p className="mt-2 text-sm font-medium text-violet-600">{newAssignmentFile.name}</p>}
                        </div>
                        <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={handleAssignmentFileChange} />
                      </label>
                    </div>
                  )}

                  {assignmentSource === 'link' && (
                    <Input
                      placeholder="Link URL (Optional)"
                      value={newAssignmentLink}
                      onChange={(e) => setNewAssignmentLink(e.target.value)}
                      className="w-full text-sm"
                    />
                  )}

                  <div className="flex gap-2 justify-end mt-2">
                    <Button type="button" variant="secondary" size="sm" onClick={resetAssignmentForm}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={assignmentSource === 'upload' && !newAssignmentFile}>Save</Button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-3">
              {(!topic.assignments || topic.assignments.length === 0) ? (
                <p className="text-sm text-slate-500 italic">No assignments for this topic.</p>
              ) : (
                topic.assignments.map((assignment) => (
                  <div key={assignment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-violet-500 shrink-0" />
                        <span className="font-medium text-slate-900 dark:text-white text-sm truncate">{assignment.title}</span>
                        {assignment.isSubmitted ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] py-0 shrink-0">
                            <CheckCircle className="w-3 h-3 mr-1 inline" /> Submitted
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] py-0 shrink-0">
                            <Clock className="w-3 h-3 mr-1 inline" /> Pending
                          </Badge>
                        )}
                      </div>
                      
                      {assignment.file && (
                        <div className="mt-2 flex items-center gap-2">
                          {assignment.file.type === 'link' ? (
                            <a href={assignment.file.url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline inline-flex items-center truncate">
                              Open Assignment Brief <ExternalLink className="w-3 h-3 ml-1 shrink-0" />
                            </a>
                          ) : (
                            <a href={assignment.file.url} target="_blank" rel="noopener noreferrer" download={assignment.file.name} className="text-xs text-violet-600 hover:underline inline-flex items-center truncate">
                              Download {assignment.file.name} <ExternalLink className="w-3 h-3 ml-1 shrink-0" />
                            </a>
                          )}
                        </div>
                      )}

                      {assignment.isSubmitted && assignment.submissionFile && (
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 p-2 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-200 dark:border-slate-700/50">
                           <span className="truncate" title={assignment.submissionFile.name}>
                             {assignment.submissionFile.name}
                           </span>
                           <a href={assignment.submissionFile.url} target="_blank" rel="noopener noreferrer" download={assignment.submissionFile.type !== 'link' ? assignment.submissionFile.name : undefined} className="text-violet-600 hover:underline shrink-0 font-medium">
                             View Submission
                           </a>
                        </div>
                      )}
                    </div>

                    {isEditMode ? (
                      <button 
                        onClick={() => { if (window.confirm('Delete assignment?')) deleteAssignment(topic.id, assignment.id); }}
                        className="text-slate-400 hover:text-red-500 p-1 self-start ml-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="w-full sm:w-auto mt-3 sm:mt-0 sm:ml-4 shrink-0">
                        {!assignment.isSubmitted ? (
                           <div className="flex flex-col gap-2">
                             <div className="flex gap-3 px-1">
                                <button type="button" onClick={() => setSubmissionSource(prev => ({...prev, [assignment.id]: 'link'}))} className={`text-xs pb-1 border-b ${(!submissionSource[assignment.id] || submissionSource[assignment.id] === 'link') ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Paste Link</button>
                                <button type="button" onClick={() => setSubmissionSource(prev => ({...prev, [assignment.id]: 'upload'}))} className={`text-xs pb-1 border-b ${(submissionSource[assignment.id] === 'upload') ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Upload File</button>
                             </div>
                             <form onSubmit={(e) => handleAssignmentSubmit(assignment.id, e)} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                {(!submissionSource[assignment.id] || submissionSource[assignment.id] === 'link') ? (
                                  <Input
                                    placeholder="Submission Link..."
                                    value={submissionLinks[assignment.id] || ''}
                                    onChange={(e) => setSubmissionLinks({ ...submissionLinks, [assignment.id]: e.target.value })}
                                    className="w-full sm:w-48 text-xs h-8"
                                    required
                                  />
                                ) : (
                                  <div className="w-full sm:w-48 overflow-hidden relative border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 flex items-center">
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                                      onChange={(e) => handleSubmissionFileChange(assignment.id, e)}
                                      className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 dark:file:bg-violet-900/30 dark:file:text-violet-300 w-full cursor-pointer"
                                      required
                                    />
                                  </div>
                                )}
                                <Button type="submit" size="sm" className="h-8 text-xs whitespace-nowrap">
                                  Submit
                                </Button>
                             </form>
                           </div>
                        ) : (
                          <div className="flex items-center justify-end h-full">
                            <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => updateAssignment(topic.id, assignment.id, { isSubmitted: false, submissionFile: undefined })}>
                              Unsubmit
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            {isEditMode && (
              <TextArea 
                value={topic.notes || ''}
                onChange={(e) => updateTopic(topic.id, { notes: e.target.value })}
                placeholder="Add notes for this topic..."
                className="w-full text-sm"
              />
            )}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Resources</h4>
                {isEditMode && (
                  <Button variant="secondary" size="sm" onClick={() => setIsAddingResource(true)} className="w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-1" /> Add Resource
                  </Button>
                )}
              </div>
              
              {isAddingResource && (
                <div className="mb-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-700">
                  <div className="flex gap-4 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <button 
                      type="button"
                      onClick={() => setResourceSource('link')}
                      className={`text-sm font-medium pb-1 border-b-2 transition-colors ${resourceSource === 'link' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Paste Link
                    </button>
                    <button 
                      type="button"
                      onClick={() => setResourceSource('upload')}
                      className={`text-sm font-medium pb-1 border-b-2 transition-colors ${resourceSource === 'upload' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Upload File
                    </button>
                  </div>
                  
                  <form onSubmit={handleAddResource} className="flex flex-col gap-3">
                    {resourceSource === 'upload' && (
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">PDF, MP4, PNG, JPG or GIF</p>
                            {selectedFile && <p className="mt-2 text-sm font-medium text-violet-600">{selectedFile.name}</p>}
                          </div>
                          <input type="file" className="hidden" accept="image/*,video/*,application/pdf" onChange={handleFileChange} />
                        </label>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input 
                        placeholder="Resource Title" 
                        value={newResource.title} 
                        onChange={e => setNewResource({...newResource, title: e.target.value})} 
                        className="flex-1"
                        required
                      />
                      {resourceSource === 'link' && (
                        <Input 
                          placeholder="URL (https://...)" 
                          value={newResource.url} 
                          onChange={e => setNewResource({...newResource, url: e.target.value})} 
                          className="flex-1"
                          required={resourceSource === 'link'}
                        />
                      )}
                      <select 
                        value={newResource.type}
                        onChange={(e) => setNewResource({...newResource, type: e.target.value as Resource['type']})}
                        className="w-full sm:w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                      >
                        <option value="link">Link</option>
                        <option value="video">Video</option>
                        <option value="pdf">PDF</option>
                        <option value="photo">Photo</option>
                        <option value="textbook">Textbook</option>
                        <option value="article">Article</option>
                        <option value="other">Other</option>
                      </select>
                      <Button type="submit" size="sm" disabled={resourceSource === 'upload' && !selectedFile}>
                        Save
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              <div className="space-y-1">
                {resources.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No resources added yet.</p>
                ) : (
                  resources.map(resource => (
                    <ResourceLink key={resource.id} resource={resource} isEditMode={isEditMode} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
