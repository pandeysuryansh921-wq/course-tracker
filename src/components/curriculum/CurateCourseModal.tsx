'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { useAIStore } from '@/stores/useAIStore';
import { curateCourseWithAI, saveCuratedCourseToDatabase } from '@/lib/ai/curator';
import { AIProvider, CurateCourseRequest, CuratedCourseResponse, SUPPORTED_MODELS } from '@/types/ai';
import { 
  Sparkles, 
  Wand2, 
  Brain, 
  Clock, 
  BookOpen, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Key, 
  RefreshCw, 
  Layers, 
  Check,
  Compass,
  GraduationCap
} from 'lucide-react';

interface CurateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

const SAMPLE_SUGGESTIONS = [
  'Deep Learning & Medical Imaging with PyTorch',
  'Distributed Systems & Concurrency in Rust',
  'Next.js 15 & Full-Stack TypeScript Architecture',
  'Computer Systems & Linux Kernel Engineering',
  'Large Language Models (LLMs) & Agentic Workflows'
];

const GENERATING_STEPS = [
  'Analyzing learning goals and technical domain...',
  'Synthesizing prerequisites & target outcomes...',
  'Architecting modular pedagogical curriculum...',
  'Drafting concrete topics & study hours...',
  'Curating verified documentation, videos & tutorials...',
  'Finalizing canonical course blueprint...'
];

export function CurateCourseModal({ isOpen, onClose, initialPrompt = '' }: CurateCourseModalProps) {
  const router = useRouter();
  const { 
    keys, 
    activeProvider, 
    activeModel, 
    setKey, 
    setActiveProvider, 
    setActiveModel, 
    hasKey,
    testConnection,
    connectionStatuses
  } = useAIStore();

  // Modal Flow Step: 'prompt' | 'generating' | 'review'
  const [step, setStep] = useState<'prompt' | 'generating' | 'review'>('prompt');
  
  // Prompt Form State
  const [topicPrompt, setTopicPrompt] = useState(initialPrompt);
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [focus, setFocus] = useState<'comprehensive' | 'project-first' | 'fast-track' | 'interview-prep'>('comprehensive');
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [prerequisites, setPrerequisites] = useState('');
  const [targetOutcomes, setTargetOutcomes] = useState('');
  const [enableWebSearch, setEnableWebSearch] = useState(true);

  // Inline Key Entry State
  const [inlineKey, setInlineKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [inlineKeyError, setInlineKeyError] = useState<string | null>(null);

  // Generation & Review State
  const [generatingStepIdx, setGeneratingStepIdx] = useState(0);
  const [curatedBlueprint, setCuratedBlueprint] = useState<CuratedCourseResponse | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({ 0: true });
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialPrompt) {
      setTopicPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // Step ticker during generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'generating') {
      setGeneratingStepIdx(0);
      interval = setInterval(() => {
        setGeneratingStepIdx((prev) => (prev + 1) % GENERATING_STEPS.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [step]);

  const providerHasKey = hasKey(activeProvider);

  const handleSaveInlineKey = async () => {
    if (!inlineKey.trim()) return;
    setIsSavingKey(true);
    setInlineKeyError(null);
    try {
      setKey(activeProvider, inlineKey.trim());
      const ok = await testConnection(activeProvider);
      if (!ok) {
        setInlineKeyError('Invalid API key. Please check your credentials.');
      } else {
        setInlineKey('');
      }
    } catch (err: any) {
      setInlineKeyError(err.message || 'Key validation failed');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleStartGeneration = async () => {
    if (!topicPrompt.trim()) {
      setErrorMessage('Please enter a course topic or learning goal.');
      return;
    }

    if (!providerHasKey) {
      setErrorMessage(`Please configure your ${activeProvider.toUpperCase()} API key first.`);
      return;
    }

    setErrorMessage(null);
    setStep('generating');

    try {
      const request: CurateCourseRequest = {
        topicPrompt: topicPrompt.trim(),
        level,
        focus,
        durationWeeks,
        hoursPerWeek,
        prerequisites: prerequisites.trim() || undefined,
        targetOutcomes: targetOutcomes.trim() || undefined,
        provider: activeProvider,
        model: activeModel,
        enableWebSearch
      };

      const result = await curateCourseWithAI(request, keys);
      setCuratedBlueprint(result);
      // Auto-expand first 2 modules
      setExpandedModules({ 0: true, 1: true });
      setStep('review');
    } catch (err: any) {
      console.error('[CurateCourseModal] Error generating course:', err);
      setErrorMessage(err.message || 'Failed to curate course with AI.');
      setStep('prompt');
    }
  };

  const handleSaveToCurriculum = async () => {
    if (!curatedBlueprint) return;
    try {
      setIsSavingToDb(true);
      setErrorMessage(null);
      const newCourseId = await saveCuratedCourseToDatabase(curatedBlueprint);
      onClose();
      router.push(`/curriculum/course?id=${encodeURIComponent(newCourseId)}`);
    } catch (err: any) {
      console.error('[CurateCourseModal] Save error:', err);
      setErrorMessage(err.message || 'Failed to save course to database.');
    } finally {
      setIsSavingToDb(false);
    }
  };

  const toggleModule = (idx: number) => {
    setExpandedModules((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const removeModule = (idx: number) => {
    if (!curatedBlueprint) return;
    const updated = {
      ...curatedBlueprint,
      modules: curatedBlueprint.modules.filter((_, i) => i !== idx)
    };
    setCuratedBlueprint(updated);
  };

  const removeTopic = (mIdx: number, tIdx: number) => {
    if (!curatedBlueprint) return;
    const updatedModules = [...curatedBlueprint.modules];
    updatedModules[mIdx] = {
      ...updatedModules[mIdx],
      topics: updatedModules[mIdx].topics.filter((_, i) => i !== tIdx)
    };
    setCuratedBlueprint({
      ...curatedBlueprint,
      modules: updatedModules
    });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => {
        if (step !== 'generating') {
          onClose();
        }
      }} 
      title=""
      maxWidth="max-w-4xl"
    >
      <div className="p-1">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                AI Course Curation Engine
                <span className="text-[11px] font-semibold tracking-wide bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  BYOK
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Architect comprehensive, production-grade courses with topics, objectives & verified resources.
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: PROMPT & CONFIGURATION */}
        {step === 'prompt' && (
          <div className="space-y-5">
            {/* Topic Input & Suggestion Chips */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                What course do you want to learn or teach?
              </label>
              <Input
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                placeholder="e.g. Distributed Systems in Go, Machine Learning for Healthcare, or Modern Web Security"
                className="w-full text-base py-2.5"
                autoFocus
              />
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">Inspirations:</span>
                {SAMPLE_SUGGESTIONS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setTopicPrompt(chip)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Level & Focus */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Proficiency Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLevel(lvl)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium capitalize border transition-all ${
                        level === lvl
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Pedagogical Focus
                </label>
                <select
                  value={focus}
                  onChange={(e) => setFocus(e.target.value as any)}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="comprehensive">Comprehensive (Theory + Applied Mastery)</option>
                  <option value="project-first">Project-First (Portfolio & Hands-on)</option>
                  <option value="fast-track">Fast-Track (High-Yield Core Essentials)</option>
                  <option value="interview-prep">Interview & System Design Focus</option>
                </select>
              </div>
            </div>

            {/* Duration & Weekly Commitment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <div>
                <div className="flex justify-between items-center text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-500" /> Duration</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{durationWeeks} Weeks</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="24"
                  step="1"
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5 text-indigo-500" /> Pace</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{hoursPerWeek} hrs / week</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="40"
                  step="1"
                  value={hoursPerWeek}
                  onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>

            {/* AI Provider & BYOK Status */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    AI BYOK Model Selection
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {providerHasKey ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Key Configured
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Key Required
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">AI Provider</label>
                  <select
                    value={activeProvider}
                    onChange={(e) => setActiveProvider(e.target.value as AIProvider)}
                    className="w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                  >
                    <option value="gemini">Google Gemini (Free & High Speed)</option>
                    <option value="groq">Groq (Ultra-Fast LPUs)</option>
                    <option value="openai">OpenAI (GPT-4o)</option>
                    <option value="anthropic">Anthropic (Claude 3.7 / 3.5)</option>
                    <option value="openrouter">OpenRouter (Unified)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Model</label>
                  <select
                    value={activeModel}
                    onChange={(e) => setActiveModel(e.target.value)}
                    className="w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                  >
                    {SUPPORTED_MODELS[activeProvider]?.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.isRecommended ? '★ Recommended' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Inline Key Entry if missing */}
              {!providerHasKey && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80">
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                    Enter your <strong>{activeProvider.toUpperCase()}</strong> API key to generate this course. Stored 100% locally in your browser.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder={`Enter ${activeProvider} API key...`}
                      value={inlineKey}
                      onChange={(e) => setInlineKey(e.target.value)}
                      className="text-xs flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveInlineKey}
                      disabled={isSavingKey || !inlineKey.trim()}
                    >
                      {isSavingKey ? 'Verifying...' : 'Save Key'}
                    </Button>
                  </div>
                  {inlineKeyError && (
                    <p className="text-[11px] text-red-500 mt-1">{inlineKeyError}</p>
                  )}
                  {activeProvider === 'gemini' && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Don't have one? Get a free Gemini API key at{' '}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-500 underline inline-flex items-center gap-0.5"
                      >
                        Google AI Studio <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Optional Additional Guidance */}
            <details className="text-xs group">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium list-none flex items-center gap-1">
                <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                Advanced: Custom prerequisites or specific focus areas (Optional)
              </summary>
              <div className="pt-3 space-y-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700 mt-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Your current background / prerequisites
                  </label>
                  <Input
                    value={prerequisites}
                    onChange={(e) => setPrerequisites(e.target.value)}
                    placeholder="e.g. Basic Python, comfortable with algebra, zero medical background"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Specific dream capstone project or target outcome
                  </label>
                  <Input
                    value={targetOutcomes}
                    onChange={(e) => setTargetOutcomes(e.target.value)}
                    placeholder="e.g. Build a tumor classification pipeline from MRI scans"
                    className="text-xs"
                  />
                </div>
              </div>
            </details>

            {/* Generate Button */}
            <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleStartGeneration}
                disabled={!providerHasKey || !topicPrompt.trim()}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20"
              >
                <Sparkles className="w-4 h-4 mr-1.5" /> Curate Curriculum
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: GENERATING SCREEN */}
        {step === 'generating' && (
          <div className="py-14 px-6 text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/30 animate-pulse">
                <Brain className="w-10 h-10" />
              </div>
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Designing Your Master Curriculum
              </h3>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 transition-all duration-300 min-h-[20px]">
                {GENERATING_STEPS[generatingStepIdx]}
              </p>
              <p className="text-xs text-slate-400">
                Calling {activeProvider.toUpperCase()} ({activeModel}). Analyzing real-world syllabi and verified resources...
              </p>
            </div>

            <div className="w-full max-w-md mx-auto bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full w-3/4 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {/* STEP 3: BLUEPRINT REVIEW & EDITING */}
        {step === 'review' && curatedBlueprint && (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Course Blueprint Header Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-200/60 dark:border-blue-900/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {curatedBlueprint.code && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-[11px] font-bold rounded">
                        {curatedBlueprint.code}
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {curatedBlueprint.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {curatedBlueprint.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1 border-t border-blue-200/40 dark:border-slate-700/50">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  ⚡ {curatedBlueprint.modules.length} Modules
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  📚 {curatedBlueprint.modules.reduce((acc, m) => acc + m.topics.length, 0)} Topics
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  ⏱ ~{curatedBlueprint.estimatedHours} Total Study Hours
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 capitalize">
                  🎯 Level: {curatedBlueprint.level}
                </span>
              </div>
            </div>

            {/* Modules & Topics List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Curated Modules & Study Plan
                </h4>
                <span className="text-[11px] text-slate-400">
                  Click to inspect topics & resources, or remove any you don't need
                </span>
              </div>

              {curatedBlueprint.modules.map((mod, mIdx) => {
                const isExpanded = Boolean(expandedModules[mIdx]);
                return (
                  <div
                    key={mIdx}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900"
                  >
                    {/* Module Bar */}
                    <div
                      onClick={() => toggleModule(mIdx)}
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                          {mIdx + 1}
                        </span>
                        <div>
                          <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                            {mod.name}
                          </h5>
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {mod.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium">
                          {mod.topics.length} topics
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeModule(mIdx);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                          title="Remove module"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Topics Container */}
                    {isExpanded && (
                      <div className="p-3 space-y-2.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                        {mod.topics.map((topic, tIdx) => (
                          <div
                            key={tIdx}
                            className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2 group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {topic.name}
                                  </span>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    {topic.estimatedHours}h
                                  </span>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 uppercase">
                                    {topic.difficulty}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {topic.description}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeTopic(mIdx, tIdx)}
                                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                title="Remove topic"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Learning Objectives */}
                            {topic.learningObjectives.length > 0 && (
                              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Key Objectives: </span>
                                {topic.learningObjectives.join(' • ')}
                              </div>
                            )}

                            {/* Curated Resources */}
                            {topic.resources.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {topic.resources.map((res, rIdx) => (
                                  <a
                                    key={rIdx}
                                    href={res.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-100 transition-colors"
                                  >
                                    <BookOpen className="w-2.5 h-2.5" />
                                    <span className="max-w-[140px] truncate">{res.title}</span>
                                    <ExternalLink className="w-2 h-2 opacity-60" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep('prompt')}
                disabled={isSavingToDb}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Adjust & Regenerate
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={isSavingToDb}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveToCurriculum}
                  disabled={isSavingToDb}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-600/20 font-semibold"
                >
                  {isSavingToDb ? (
                    'Saving Course to Database...'
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" /> Save to Curriculum
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
