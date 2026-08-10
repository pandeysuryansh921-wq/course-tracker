'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { generateId, COURSE_COLORS, COURSE_ICONS } from '@/lib/utils';
import * as Icons from 'lucide-react';
import { Trash2, Plus } from 'lucide-react';

interface AddCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddCourseModal({ isOpen, onClose }: AddCourseModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [icon, setIcon] = useState(COURSE_ICONS[0]);
  const [gemLinks, setGemLinks] = useState<Array<{ id: string, title: string, description: string, url: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const addCourse = useCurriculumStore(state => state.addCourse);

  const handleAddGemLink = () => {
    setGemLinks([...gemLinks, { id: generateId(), title: '', description: '', url: '' }]);
  };

  const handleUpdateGemLink = (id: string, field: string, value: string) => {
    setGemLinks(gemLinks.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const handleRemoveGemLink = (id: string) => {
    setGemLinks(gemLinks.filter(g => g.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsLoading(true);
    addCourse(name, description, color, icon, gemLinks.filter(g => g.title && g.url));
    
    setIsLoading(false);
    setName('');
    setDescription('');
    setColor(COURSE_COLORS[0]);
    setIcon(COURSE_ICONS[0]);
    setGemLinks([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Course">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Course Name</label>
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="e.g. Introduction to Computer Science"
            required
            className="w-full"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
          <TextArea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="Brief description of the course..."
            className="w-full h-24"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Gemini Gem Tutors (Optional)</label>
            <Button type="button" variant="secondary" onClick={handleAddGemLink} className="py-1 px-2 text-xs h-auto">
              <Plus className="w-3 h-3 mr-1" /> Add Gem
            </Button>
          </div>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {gemLinks.length === 0 && (
              <div className="text-sm text-slate-500 italic p-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-center">
                No Gemini Gems added. Click "Add Gem" to include an AI tutor.
              </div>
            )}
            {gemLinks.map((gem, index) => (
              <div key={gem.id} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 relative group">
                <button 
                  type="button"
                  onClick={() => handleRemoveGemLink(gem.id)}
                  className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="space-y-2 pr-6">
                  <Input 
                    value={gem.title} 
                    onChange={(e) => handleUpdateGemLink(gem.id, 'title', e.target.value)} 
                    placeholder="Gem Title (e.g. CS50 Tutor)"
                    className="w-full text-sm py-1.5"
                    required
                  />
                  <Input 
                    value={gem.url} 
                    onChange={(e) => handleUpdateGemLink(gem.id, 'url', e.target.value)} 
                    placeholder="Gem URL (https://gemini.google.com/gem/...)"
                    className="w-full text-sm py-1.5"
                    type="url"
                    required
                  />
                  <Input 
                    value={gem.description} 
                    onChange={(e) => handleUpdateGemLink(gem.id, 'description', e.target.value)} 
                    placeholder="Short description (optional)"
                    className="w-full text-sm py-1.5"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Color</label>
          <div className="flex flex-wrap gap-2">
            {COURSE_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Icon</label>
          <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-md">
            {COURSE_ICONS.map(iconName => {
              const IconComponent = (Icons as any)[iconName];
              if (!IconComponent) return null;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  className={`p-2 rounded-md flex items-center justify-center transition-colors ${icon === iconName ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                >
                  <IconComponent className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim() || isLoading}>
            {isLoading ? 'Creating...' : 'Create Course'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
