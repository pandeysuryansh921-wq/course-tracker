'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCurriculumStore } from '@/stores/useCurriculumStore';

interface AddTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  moduleId: string | null;
}

export default function AddTopicModal({ isOpen, onClose, courseId, moduleId }: AddTopicModalProps) {
  const [name, setName] = useState('');
  const [quizUrl, setQuizUrl] = useState('');
  const [quizMaxScore, setQuizMaxScore] = useState<number>(100);
  
  const addTopic = useCurriculumStore((state) => state.addTopic);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !moduleId) return;

    addTopic(moduleId, courseId, name, quizUrl, quizMaxScore);

    setName('');
    setQuizUrl('');
    setQuizMaxScore(100);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Topic">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Topic Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Introduction to Variables"
            required
            className="w-full"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">External Quiz Link (Optional)</label>
            <Input
              value={quizUrl}
              onChange={(e) => setQuizUrl(e.target.value)}
              placeholder="e.g. https://forms.google.com/..."
              className="w-full"
            />
          </div>
          <div className="w-1/3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Score</label>
            <Input
              type="number"
              min="1"
              value={quizMaxScore}
              onChange={(e) => setQuizMaxScore(Number(e.target.value) || 100)}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim() || !moduleId}>Create Topic</Button>
        </div>
      </form>
    </Modal>
  );
}
