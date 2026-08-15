'use client';

import { useState, useEffect } from 'react';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Layers, Plus, Trash2, BrainCircuit } from 'lucide-react';
import type { Flashcard } from '@/types/curriculum';

interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string;
}

export function FlashcardModal({ isOpen, onClose, topicId }: FlashcardModalProps) {
  const { getTopicFlashcards, addFlashcard, deleteFlashcard, reviewFlashcard } = useCurriculumStore();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  const [activeCardIndex, setActiveCardIndex] = useState(-1);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFlashcards(getTopicFlashcards(topicId));
      setIsAdding(false);
      setActiveCardIndex(-1);
      setIsFlipped(false);
    }
  }, [isOpen, topicId, getTopicFlashcards]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    
    await addFlashcard(topicId, front, back);
    setFront('');
    setBack('');
    setIsAdding(false);
    setFlashcards(getTopicFlashcards(topicId));
  };

  const handleDelete = async (id: string) => {
    await deleteFlashcard(id);
    setFlashcards(getTopicFlashcards(topicId));
  };

  const startReview = () => {
    if (flashcards.length > 0) {
      setActiveCardIndex(0);
      setIsFlipped(false);
    }
  };

  const handleScore = async (quality: number) => {
    if (activeCardIndex >= 0 && activeCardIndex < flashcards.length) {
      const card = flashcards[activeCardIndex];
      await reviewFlashcard(card.id, quality);
      
      if (activeCardIndex + 1 < flashcards.length) {
        setActiveCardIndex(activeCardIndex + 1);
        setIsFlipped(false);
      } else {
        setActiveCardIndex(-1);
        setFlashcards(getTopicFlashcards(topicId));
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Flashcards (Active Recall)">
      {activeCardIndex >= 0 ? (
        <div className="flex flex-col items-center justify-center p-6 min-h-[300px]">
          <div className="w-full text-right text-sm text-slate-500 mb-4">
            Card {activeCardIndex + 1} of {flashcards.length}
          </div>
          
          <div 
            className={`w-full max-w-md h-64 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 p-8 flex items-center justify-center text-center cursor-pointer transition-all duration-500 transform-gpu ${isFlipped ? 'bg-violet-50 dark:bg-violet-900/20 rotate-x-180' : 'bg-white dark:bg-slate-900'}`}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className={`text-xl font-medium ${isFlipped ? 'rotate-x-180' : ''}`}>
              {isFlipped ? flashcards[activeCardIndex].back : flashcards[activeCardIndex].front}
            </div>
          </div>
          
          <div className="mt-8 text-sm text-slate-500">
            {!isFlipped ? "Click card to flip" : "How well did you know this?"}
          </div>
          
          {isFlipped && (
            <div className="mt-4 flex gap-2 w-full max-w-md justify-between">
              <Button variant="secondary" className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 border-red-200" onClick={(e) => { e.stopPropagation(); handleScore(1); }}>Again</Button>
              <Button variant="secondary" className="flex-1 bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200" onClick={(e) => { e.stopPropagation(); handleScore(3); }}>Hard</Button>
              <Button variant="secondary" className="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200" onClick={(e) => { e.stopPropagation(); handleScore(4); }}>Good</Button>
              <Button variant="secondary" className="flex-1 bg-green-50 text-green-600 hover:bg-green-100 border-green-200" onClick={(e) => { e.stopPropagation(); handleScore(5); }}>Easy</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center bg-violet-50 dark:bg-violet-500/10 p-4 rounded-xl border border-violet-100 dark:border-violet-500/20">
            <div>
              <h3 className="font-semibold text-violet-900 dark:text-violet-100 flex items-center gap-2">
                <BrainCircuit size={18} />
                Spaced Repetition
              </h3>
              <p className="text-sm text-violet-700 dark:text-violet-300">
                {flashcards.length} cards total. Review regularly to retain knowledge!
              </p>
            </div>
            <Button onClick={startReview} disabled={flashcards.length === 0} className="bg-violet-600 hover:bg-violet-700 text-white">
              Start Review
            </Button>
          </div>

          <div className="flex justify-between items-center">
            <h4 className="font-medium text-slate-700 dark:text-slate-300">Your Cards</h4>
            <Button variant="secondary" size="sm" onClick={() => setIsAdding(!isAdding)}>
              <Plus size={16} className="mr-1" /> Add Card
            </Button>
          </div>

          {isAdding && (
            <form onSubmit={handleAdd} className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
              <Input
                label="Front (Question)"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                placeholder="What is the powerhouse of the cell?"
                autoFocus
              />
              <Input
                label="Back (Answer)"
                value={back}
                onChange={(e) => setBack(e.target.value)}
                placeholder="Mitochondria"
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="ghost" type="button" onClick={() => setIsAdding(false)}>Cancel</Button>
                <Button type="submit">Save Card</Button>
              </div>
            </form>
          )}

          <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
            {flashcards.length === 0 && !isAdding ? (
              <div className="text-center p-8 text-slate-500 border border-dashed rounded-xl dark:border-slate-800">
                No flashcards yet. Create some to test your knowledge!
              </div>
            ) : (
              flashcards.map(card => (
                <div key={card.id} className="flex justify-between items-start p-3 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100">Q: {card.front}</div>
                    <div className="text-sm text-slate-500 mt-1">A: {card.back}</div>
                  </div>
                  <button 
                    onClick={() => handleDelete(card.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
