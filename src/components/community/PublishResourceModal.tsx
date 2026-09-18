'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { CommunityResourcePayload, downloadJsonFile, publishToCommunityOneTap } from '@/lib/community';
import { ShieldCheck, Copy, Check, Download, Star, Globe, AlertCircle, ExternalLink, Send, Sparkles, Loader2 } from 'lucide-react';

interface PublishResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: CommunityResourcePayload | null;
}

export function PublishResourceModal({ isOpen, onClose, payload }: PublishResourceModalProps) {
  const [copied, setCopied] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  if (!payload) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const slug = payload.resource.title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
    downloadJsonFile(payload, `community_res_${slug}.json`);
  };

  const handleOneTapPublish = async () => {
    try {
      setIsPublishing(true);
      setPublishMessage(null);
      const res = await publishToCommunityOneTap(payload, payload.resource.title);
      setPublishMessage(res.message);
      setTimeout(() => setPublishMessage(null), 5000);
    } catch (err: any) {
      alert(`Publish error: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share with Community">
      <div className="flex flex-col gap-5">
        {/* Privacy Guarantee Banner */}
        <div className="flex items-start gap-3 p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold block text-emerald-900 dark:text-emerald-200">
              Verified 100% Sanitized (Privacy Firewall Active)
            </span>
            Only the educational link and aggregated effectiveness score are exported. Your personal notes, quiz answers, study schedule, and identity never leave your device.
          </div>
        </div>

        {publishMessage && (
          <div className="flex items-center gap-2 p-3 bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{publishMessage}</span>
          </div>
        )}

        {/* Resource Summary Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              {payload.resource.title}
            </h3>
            {payload.metrics.confidenceScore > 0 && (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full text-xs font-bold shrink-0 border border-amber-200 dark:border-amber-800/40">
                <Star className="w-3.5 h-3.5 fill-current" />
                {payload.metrics.confidenceScore} Rating
              </div>
            )}
          </div>

          <a 
            href={payload.resource.canonicalUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate"
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{payload.resource.canonicalUrl}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>

          {payload.context.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {payload.context.topics.map((topic, i) => (
                <span 
                  key={i} 
                  className="px-2 py-0.5 bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 rounded text-[11px]"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Transparent Payload Preview */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Export Manifest Preview (Ready for Sharing / PR)</span>
            <span>Schema: degreetrack.community.v1</span>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-[140px] custom-scrollbar border border-slate-800">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>

        {/* 1-Tap Publish Button */}
        <button
          onClick={handleOneTapPublish}
          disabled={isPublishing}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all active:scale-98 disabled:opacity-50"
        >
          {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>{isPublishing ? 'Publishing to Community...' : '🚀 1-Tap Publish to Community'}</span>
        </button>

        {/* Secondary Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied to Clipboard!' : 'Copy Sanitized JSON'}
          </button>
          
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            Download (.json)
          </button>
        </div>
      </div>
    </Modal>
  );
}
