import type { Resource } from '@/types/curriculum';

export function extractDriveFileId(url: string): string {
  if (!url) return '';
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;
  return '';
}


export function isVideoResource(resource: Resource): boolean {
  return resource.type?.toLowerCase() === 'video' ||
    Boolean(resource.mimeType?.toLowerCase().startsWith('video/')) ||
    /\.(mp4|mkv|webm|mov|m4v|avi)(?:[?#].*)?$/i.test(resource.url || '') ||
    /\.(mp4|mkv|webm|mov|m4v|avi)$/i.test(resource.title || '');
}
