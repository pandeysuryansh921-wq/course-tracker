/**
 * Centralized Playback Diagnostics & Tracing for DegreeTrack Native Video Playback.
 * Tracks each discrete step from Resource click to ExoPlayer playback start.
 */

export interface PlaybackTraceStep {
  step: string; // e.g. "01", "02", ...
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  detail?: string;
  timestamp: number;
}

export interface PlaybackDiagnosticsState {
  topicId?: string;
  courseTitle?: string;
  lectureTitle?: string;
  fileId?: string;
  platform?: string;
  isNative?: boolean;
  hasError: boolean;
  errorMessage?: string;
  errorDetails?: string;
  steps: PlaybackTraceStep[];
}

type TraceListener = (state: PlaybackDiagnosticsState) => void;

class PlaybackDiagnosticsManager {
  private state: PlaybackDiagnosticsState = {
    hasError: false,
    steps: [
      { step: '01', name: 'Resource click', status: 'pending', timestamp: Date.now() },
      { step: '02', name: 'Video classified', status: 'pending', timestamp: Date.now() },
      { step: '03', name: 'Android native confirmed', status: 'pending', timestamp: Date.now() },
      { step: '04', name: 'Drive file ID resolved', status: 'pending', timestamp: Date.now() },
      { step: '05', name: 'Media3 plugin available', status: 'pending', timestamp: Date.now() },
      { step: '06', name: 'OAuth token acquired', status: 'pending', timestamp: Date.now() },
      { step: '07', name: 'Source resolved', status: 'pending', timestamp: Date.now() },
      { step: '08', name: 'Plugin invoked', status: 'pending', timestamp: Date.now() },
      { step: '09', name: 'Intent created', status: 'pending', timestamp: Date.now() },
      { step: '10', name: 'Activity onCreate', status: 'pending', timestamp: Date.now() },
        { step: '11', name: 'ExoPlayer initialized', status: 'pending', timestamp: Date.now() },
        { step: '12', name: 'MediaSource created', status: 'pending', timestamp: Date.now() },
        { step: '13', name: 'prepare()', status: 'pending', timestamp: Date.now() },
        { step: '14', name: 'BUFFERING', status: 'pending', timestamp: Date.now() },
        { step: '15', name: 'READY', status: 'pending', timestamp: Date.now() },
        { step: '16', name: 'PLAYING', status: 'pending', timestamp: Date.now() },
    ]
  };

  private listeners: Set<TraceListener> = new Set();

  public reset(meta?: { topicId?: string; courseTitle?: string; lectureTitle?: string; fileId?: string }) {
    this.state = {
      topicId: meta?.topicId,
      courseTitle: meta?.courseTitle,
      lectureTitle: meta?.lectureTitle,
      fileId: meta?.fileId,
      hasError: false,
      errorMessage: undefined,
      errorDetails: undefined,
      steps: [
        { step: '01', name: 'Resource click', status: 'pending', timestamp: Date.now() },
        { step: '02', name: 'Video classified', status: 'pending', timestamp: Date.now() },
        { step: '03', name: 'Android native confirmed', status: 'pending', timestamp: Date.now() },
        { step: '04', name: 'Drive file ID resolved', status: 'pending', timestamp: Date.now() },
        { step: '05', name: 'Media3 plugin available', status: 'pending', timestamp: Date.now() },
        { step: '06', name: 'OAuth token acquired', status: 'pending', timestamp: Date.now() },
        { step: '07', name: 'Source resolved', status: 'pending', timestamp: Date.now() },
        { step: '08', name: 'Plugin invoked', status: 'pending', timestamp: Date.now() },
        { step: '09', name: 'Intent created', status: 'pending', timestamp: Date.now() },
        { step: '10', name: 'Activity onCreate', status: 'pending', timestamp: Date.now() },
        { step: '11', name: 'ExoPlayer initialized', status: 'pending', timestamp: Date.now() },
        { step: '12', name: 'MediaSource created', status: 'pending', timestamp: Date.now() },
        { step: '13', name: 'prepare()', status: 'pending', timestamp: Date.now() },
        { step: '14', name: 'BUFFERING', status: 'pending', timestamp: Date.now() },
        { step: '15', name: 'READY', status: 'pending', timestamp: Date.now() },
        { step: '16', name: 'PLAYING', status: 'pending', timestamp: Date.now() },
      ]
    };
    this.notify();
  }

  public setMeta(meta: Partial<PlaybackDiagnosticsState>) {
    this.state = { ...this.state, ...meta };
    this.notify();
  }

  public recordStep(
    stepNum: string,
    status: 'running' | 'success' | 'failed' | 'skipped',
    detail?: string
  ) {
    const existingIdx = this.state.steps.findIndex(s => s.step === stepNum);
    const logTag = `[PLAYER_TRACE_${stepNum}]`;
    const cleanDetail = detail ? ` - ${this.sanitizeDetail(detail)}` : '';

    if (status === 'success') {
      console.log(`${logTag} ✓ ${cleanDetail}`);
    } else if (status === 'failed') {
      console.error(`${logTag} ✗ ${cleanDetail}`);
      this.state.hasError = true;
      if (detail && !this.state.errorMessage) {
        this.state.errorMessage = this.sanitizeDetail(detail);
      }
    } else {
      console.log(`${logTag} ⏳ ${cleanDetail}`);
    }

    if (existingIdx !== -1) {
      this.state.steps[existingIdx] = {
        ...this.state.steps[existingIdx],
        status,
        detail: this.sanitizeDetail(detail),
        timestamp: Date.now()
      };
    } else {
      this.state.steps.push({
        step: stepNum,
        name: `Stage ${stepNum}`,
        status,
        detail: this.sanitizeDetail(detail),
        timestamp: Date.now()
      });
    }

    this.notify();
  }

  public recordError(errorMessage: string, errorDetails?: string) {
    console.error(`[PLAYER_TRACE_ERROR] ${this.sanitizeDetail(errorMessage)}`, this.sanitizeDetail(errorDetails));
    this.state.hasError = true;
    this.state.errorMessage = this.sanitizeDetail(errorMessage);
    this.state.errorDetails = this.sanitizeDetail(errorDetails);
    this.notify();
  }

  public getState(): PlaybackDiagnosticsState {
    return this.state;
  }

  public subscribe(listener: TraceListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.state = { ...this.state, steps: [...this.state.steps] };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /**
   * Sanitizes any sensitive string like full OAuth tokens
   */
  public sanitizeDetail(str?: string): string {
    if (!str) return '';
    // Replace Bearer tokens if inadvertently embedded
    return str.replace(/Bearer\s+[^\s"',;]+/gi, 'Bearer [REDACTED]')
      .replace(/ya29\.[a-zA-Z0-9_.-]+/g, '[REDACTED]');
  }

  /**
   * Generates a plain-text copyable diagnostic report for screenshots and clipboard.
   */
  public getCopyableReport(): string {
    const lines: string[] = [];
    lines.push('=== DEGREETRACK PLAYBACK TRACE ===');
    lines.push(`Time: ${new Date().toISOString()}`);
    lines.push(`Lecture: ${this.state.lectureTitle || 'Unknown'}`);
    lines.push(`Course: ${this.state.courseTitle || 'Unknown'}`);
    lines.push(`File ID: ${this.state.fileId || 'None'}`);
    lines.push(`Platform: ${this.state.platform || 'Unknown'} (isNative: ${this.state.isNative})`);
    lines.push('----------------------------------');

    for (const s of this.state.steps) {
      const sym = s.status === 'success' ? '✓' : s.status === 'failed' ? '✗' : s.status === 'running' ? '⏳' : '○';
      const detailStr = s.detail ? ` (${s.detail})` : '';
      lines.push(`${s.step} ${s.name} ${sym}${detailStr}`);
    }

    if (this.state.hasError) {
      lines.push('----------------------------------');
      lines.push(`FAILURE: ${this.state.errorMessage || 'Unknown error'}`);
      if (this.state.errorDetails) {
        lines.push(`Details: ${this.state.errorDetails}`);
      }
    }
    lines.push('==================================');
    return lines.join('\n');
  }
}

export const playbackDiagnostics = new PlaybackDiagnosticsManager();
