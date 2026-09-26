'use client';

import React, { useState } from 'react';
import { PlaybackDiagnosticsState, playbackDiagnostics } from '@/lib/player/playbackDiagnostics';
import { AlertTriangle, CheckCircle2, XCircle, Clock, Copy, Check, RotateCcw, X } from 'lucide-react';

interface PlaybackDiagnosticOverlayProps {
  state: PlaybackDiagnosticsState;
  onRetry?: () => void;
  onClose: () => void;
}

export default function PlaybackDiagnosticOverlay({
  state,
  onRetry,
  onClose
}: PlaybackDiagnosticOverlayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const text = playbackDiagnostics.getCopyableReport();
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy diagnostics:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${state.hasError ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {state.hasError ? 'Native Playback Diagnostic Failure' : 'Playback Stage Diagnostics'}
              </h3>
              <p className="text-xs text-slate-400">
                Tablet Hardware Diagnostic • {state.lectureTitle || 'Lecture'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Failure Alert Banner */}
          {state.hasError && (
            <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-xs">
                <XCircle size={15} />
                <span>Execution Stopped at Boundary</span>
              </div>
              <p className="text-xs text-red-200 font-mono break-words leading-relaxed">
                {state.errorMessage || 'Unknown playback error'}
              </p>
              {state.errorDetails && (
                <p className="text-[11px] text-red-300/80 font-mono break-all pt-1 border-t border-red-900/40">
                  {state.errorDetails}
                </p>
              )}
            </div>
          )}

          {/* Trace Checklist */}
          <div className="bg-slate-950/50 rounded-xl border border-slate-800/80 p-3 space-y-1.5 font-mono text-xs">
            {state.steps.map((s) => {
              const isSuccess = s.status === 'success';
              const isFailed = s.status === 'failed';
              const isRunning = s.status === 'running';

              return (
                <div
                  key={s.step}
                  className={`flex items-start justify-between p-2 rounded-lg transition-colors ${
                    isFailed
                      ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                      : isSuccess
                      ? 'bg-slate-900/60 text-slate-200'
                      : isRunning
                      ? 'bg-blue-500/10 text-blue-300'
                      : 'text-slate-500'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 pr-2">
                    <span className="font-bold text-[11px] text-slate-400 shrink-0">
                      {s.step}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate">{s.name}</div>
                      {s.detail && (
                        <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                          {s.detail}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center pt-0.5">
                    {isSuccess && <CheckCircle2 size={16} className="text-emerald-400" />}
                    {isFailed && <XCircle size={16} className="text-red-400" />}
                    {isRunning && <Clock size={16} className="text-blue-400 animate-pulse" />}
                    {s.status === 'pending' && <span className="text-slate-600">○</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Instructions for tester */}
          <div className="text-[11px] text-slate-400 space-y-1 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
            <p className="font-semibold text-slate-300">Instructions for Tablet Testing:</p>
            <p>1. Take a screenshot of this trace overlay.</p>
            <p>2. Tap "Copy Diagnostic Log" to copy the exact trace to clipboard.</p>
            <p>3. DegreeTrack stays safely in-app; no iframe or Chromium navigation occurred.</p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 gap-3">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied ✓' : 'Copy Diagnostic Log'}</span>
          </button>

          <div className="flex items-center gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <RotateCcw size={14} />
                <span>Retry</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
