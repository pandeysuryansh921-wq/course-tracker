'use client';

import React from 'react';
import { Resource } from '@/types/curriculum';
import { FileText, BookOpen, Globe, File, Video, Trash2, Image as ImageIcon, Link as LinkIcon, Download } from 'lucide-react';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { downloadBase64File } from '@/lib/utils';

interface ResourceLinkProps {
  resource: Resource;
  isEditMode?: boolean;
}

export default function ResourceLink({ resource, isEditMode = false }: ResourceLinkProps) {
  const deleteResource = useCurriculumStore(state => state.deleteResource);
  const [isViewing, setIsViewing] = React.useState(false);
  const isInline = ['pdf', 'video', 'photo'].includes(resource.type);

  const getIcon = () => {
    switch (resource.type) {
      case 'video': return <Video className="w-5 h-5 text-red-500" />;
      case 'pdf': return <FileText className="w-4 h-4" />;
      case 'textbook': return <BookOpen className="w-4 h-4" />;
      case 'article': return <Globe className="w-4 h-4" />;
      case 'photo': return <ImageIcon className="w-4 h-4" />;
      case 'link': return <LinkIcon className="w-4 h-4" />;
      default: return <File className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
        {isInline ? (
          <button 
            onClick={() => setIsViewing(!isViewing)}
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline text-left"
          >
            {getIcon()}
            <span>{resource.title}</span>
          </button>
        ) : (
          <a 
            href={resource.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {getIcon()}
            <span>{resource.title}</span>
          </a>
        )}
        {isEditMode && (
          <button 
            onClick={() => deleteResource(resource.id)}
            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete resource"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

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
              <iframe src={resource.url} className="w-full h-[500px] rounded-lg" title={resource.title} />
            )}
            {resource.type === 'video' && (
              <video src={resource.url} controls className="w-full rounded-lg" />
            )}
            {resource.type === 'photo' && (
              <img src={resource.url} alt={resource.title} className="max-w-full rounded-lg mx-auto" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
