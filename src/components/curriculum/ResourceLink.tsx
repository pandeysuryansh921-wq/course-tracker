'use client';

import React, { useState } from 'react';
import { Resource } from '@/types/curriculum';
import { 
  FileText, 
  BookOpen, 
  Globe, 
  File, 
  Video, 
  Trash2, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Download,
  Play,
  HardDrive,
  Cloud
} from 'lucide-react';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useVideoCacheStore } from '@/stores/useVideoCacheStore';
import { downloadBase64File } from '@/lib/utils';
import VideoPlayerModal from '@/components/study/VideoPlayerModal';

interface ResourceLinkProps {
  resource: Resource;
  isEditMode?: boolean;
}

function extractDriveFileId(url: string): string {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                url.match(/id=([a-zA-Z0-9_-]+)/) ||
                url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;
  return url;
}

export default function ResourceLink({ resource, isEditMode = false }: ResourceLinkProps) {
  const deleteResource = useCurriculumStore(state => state.deleteResource);
  const [isViewing, setIsViewing] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const cachedItem = useVideoCacheStore((state) => 
    resource.topicId ? state.cachedVideos[resource.topicId] : undefined
  );

  const isVideo = resource.type === 'video';
  const isInline = ['pdf', 'photo'].includes(resource.type);

  const getIcon = () => {
    switch (resource.type) {
      case 'video': return <Video className="w-5 h-5 text-red-500" />;
      case 'pdf': return <FileText className="w-4 h-4 text-orange-500" />;
      case 'textbook': return <BookOpen className="w-4 h-4 text-emerald-500" />;
      case 'article': return <Globe className="w-4 h-4 text-blue-500" />;
      case 'photo': return <ImageIcon className="w-4 h-4 text-purple-500" />;
      case 'link': return <LinkIcon className="w-4 h-4 text-slate-500" />;
      default: return <File className="w-4 h-4 text-slate-500" />;
    }
  };

  const handleOpen = () => {
    if (isVideo) {
      setIsVideoModalOpen(true);
    } else if (isInline) {
      setIsViewing(!isViewing);
    } else {
      window.open(resource.url, '_blank', 'noopener,noreferrer');
    }
  };

  const driveFileId = isVideo ? extractDriveFileId(resource.url) : '';

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group">
          <div className="flex items-center gap-2 overflow-hidden pr-2">
            <button 
              type="button"
              onClick={handleOpen}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline text-left truncate"
            >
              {getIcon()}
              <span className="truncate">{resource.title}</span>
            </button>

            {isVideo && (
              <span className="shrink-0 flex items-center gap-1">
                {cachedItem?.status === 'cached' ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <HardDrive size={10} /> Offline
                  </span>
                ) : cachedItem?.status === 'downloading' ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                    Downloading {cachedItem.downloadProgress}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <Cloud size={10} /> Stream
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isVideo && (
              <button
                type="button"
                onClick={() => setIsVideoModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <Play size={12} fill="currentColor" /> Play
              </button>
            )}

            {isEditMode && (
              <button 
                onClick={() => deleteResource(resource.id)}
                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                title="Delete resource"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {resource.scopeInstructions && (
          <div className="ml-7 mb-1 flex items-center">
            {['PRIMARY', 'SECONDARY', 'VISUAL', 'PRACTICE', 'IMPLEMENTATION', 'REFERENCE', 'DEEP_DIVE', 'RESEARCH', 'REVISION'].includes(resource.scopeInstructions.toUpperCase()) ? (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                resource.scopeInstructions.toUpperCase() === 'PRIMARY' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
                resource.scopeInstructions.toUpperCase() === 'SECONDARY' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                resource.scopeInstructions.toUpperCase() === 'PRACTICE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              }`}>
                {resource.scopeInstructions}
              </span>
            ) : (
              <div className="p-2 w-full bg-blue-50 dark:bg-blue-900/10 border-l-2 border-blue-400 dark:border-blue-700 rounded-r-md">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">Study Scope</span>
                <p className="text-xs text-blue-900 dark:text-blue-200">{resource.scopeInstructions}</p>
              </div>
            )}
          </div>
        )}

        {/* Inline PDF / Photo Viewer */}
        {isInline && isViewing && (
          <div className="mt-2 mb-4 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <div className="flex justify-between items-center p-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{resource.title}</span>
              <div className="flex gap-3">
                 <button onClick={() => downloadBase64File(resource.url, resource.title)} className="text-xs font-medium text-violet-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3"/> Download</button>
                 <button onClick={() => setIsViewing(false)} className="text-xs font-medium text-slate-500 hover:text-slate-700">Close</button>
              </div>
            </div>
            <div className="p-2">
              {resource.type === 'pdf' && (
                <iframe src={resource.url.replace(/\/view.*$/, '/preview')} className="w-full h-[500px] rounded-lg" title={resource.title} />
              )}
              {resource.type === 'photo' && (
                <img src={resource.url} alt={resource.title} className="max-w-full rounded-lg mx-auto" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Video Player Modal with Smart Rolling Cache */}
      {isVideo && (
        <VideoPlayerModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          topicId={resource.topicId || ''}
          courseId={resource.courseId || ''}
          lectureTitle={resource.title}
          fileId={driveFileId}
        />
      )}
    </>
  );
}
