import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GemLink } from '@/types/curriculum';
import { generateId } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface AddGemLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (gemLink: GemLink) => void;
}

export default function AddGemLinkModal({ isOpen, onClose, onAdd }: AddGemLinkModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;

    onAdd({
      id: generateId(),
      title: title.trim(),
      description: description.trim(),
      url: url.trim(),
    });

    setTitle('');
    setDescription('');
    setUrl('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Gemini Gem">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-xl border border-violet-100 dark:border-violet-800/50 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
          <p className="text-sm text-violet-700 dark:text-violet-300">
            Link a customized Gemini Gem to this course. Students will be able to launch it directly to get personalized tutoring or study plans.
          </p>
        </div>

        <Input
          label="Gem Name"
          placeholder="e.g., Computer Science AI Tutor"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        
        <Input
          label="Gem Link (URL)"
          placeholder="https://gemini.google.com/g/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          required
        />
        
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--text-main)]">Description (Optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-border bg-card p-3 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px] resize-y"
            placeholder="What should students use this Gem for?"
          />
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim() || !url.trim()}>
            Add Gem
          </Button>
        </div>
      </form>
    </Modal>
  );
}
