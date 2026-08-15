// Utility helpers for DegreeTrack

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${secs}s`;
}

export function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-emerald-500';
    case 'in-progress': return 'text-blue-500';
    case 'needs-review': return 'text-amber-500';
    default: return 'text-slate-400';
  }
}

export function getStatusBg(status: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'in-progress': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'needs-review': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed': return 'Completed';
    case 'in-progress': return 'In Progress';
    case 'needs-review': return 'Needs Review';
    default: return 'Not Started';
  }
}

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'hard': return 'bg-red-500/10 text-red-500 border-red-500/20';
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

export function calculateStreakDays(sessions: { endedAt: Date }[]): number {
  if (sessions.length === 0) return 0;
  
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
  );
  
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let checkDate = new Date(today);
  
  for (let i = 0; i < 365; i++) {
    const dayStart = new Date(checkDate);
    const dayEnd = new Date(checkDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const hasSession = sorted.some(s => {
      const d = new Date(s.endedAt);
      return d >= dayStart && d <= dayEnd;
    });
    
    if (hasSession) {
      streak++;
    } else if (i > 0) {
      break;
    }
    
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  return streak;
}

export function estimateCompletionDays(
  totalTopics: number,
  completedTopics: number,
  avgTopicsPerDay: number
): number {
  if (avgTopicsPerDay <= 0 || completedTopics >= totalTopics) return 0;
  const remaining = totalTopics - completedTopics;
  return Math.ceil(remaining / Math.max(avgTopicsPerDay, 0.1));
}

export const COURSE_COLORS = [
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#ef4444', // red
  '#10b981', // emerald
  '#ec4899', // pink
  '#3b82f6', // blue
  '#f97316', // orange
];

export const COURSE_ICONS = [
  'BookOpen', 'Code', 'Cpu', 'Database', 'FlaskConical',
  'Globe', 'Layers', 'Lightbulb', 'Monitor', 'Palette',
  'PenTool', 'Server', 'Shield', 'Terminal', 'Zap',
];

export function downloadBase64File(base64Data: string, filename: string) {
  try {
    const parts = base64Data.split(';base64,');
    if (parts.length !== 2) {
      // If it's not a valid base64 data URI, just try to open it
      window.open(base64Data, '_blank');
      return;
    }
    
    const contentType = parts[0].split(':')[1];
    const byteCharacters = atob(parts[1]);
    const byteArrays: Uint8Array[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays as unknown as BlobPart[], { type: contentType });
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) {
    console.error("Failed to download file:", error);
    // Fallback
    const a = document.createElement('a');
    a.href = base64Data;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

