'use client';

import React, { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { useCurriculumStore } from '@/stores/useCurriculumStore';

interface AddModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
}

export default function AddModuleModal({ isOpen, onClose, courseId }: AddModuleModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notebookUrl, setNotebookUrl] = useState('');

  // Select the raw array (referentially stable) and the action function
  const addModule = useCurriculumStore((state) => state.addModule);
  const allModules = useCurriculumStore((state) => state.modules);

  // Derive the filtered list via useMemo — only recomputes when allModules
  // or courseId actually change, avoiding the new-array-every-render trap.
  const modules = useMemo(
    () => allModules.filter((m) => m.courseId === courseId),
    [allModules, courseId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addModule(courseId, name, description, notebookUrl);

    setName('');
    setDescription('');
    setNotebookUrl('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Module">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Module Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Week 1: Basics"
            required
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will this module cover?"
            className="w-full h-24"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">NotebookLM Hub URL (Optional)</label>
          <Input
            value={notebookUrl}
            onChange={(e) => setNotebookUrl(e.target.value)}
            placeholder="https://notebooklm.google.com/..."
            className="w-full"
            type="url"
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim()}>Create Module</Button>
        </div>
      </form>
    </Modal>
  );
}
