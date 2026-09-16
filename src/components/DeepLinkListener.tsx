'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { App, URLOpenListenerEvent } from '@capacitor/app';

import { useCurriculumStore } from '@/stores/useCurriculumStore';

export default function DeepLinkListener() {
  const router = useRouter();

  useEffect(() => {
    let listenerRef: any = null;

    const setupListener = async () => {
      listenerRef = await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        const url = event.url;
        // Expected format: ecosystem://learn/topic/123
        if (url.startsWith('ecosystem://learn/')) {
          const pathString = url.replace('ecosystem://learn/', ''); // e.g. topic/123
          const parts = pathString.split('/');
          
          if (parts.length >= 2) {
            const type = parts[0];
            const id = parts[1];
            
            // Map the type to the corresponding Next.js route
            switch (type) {
              case 'course':
                router.push(`/curriculum/course?id=${id}`);
                break;
              case 'module': {
                const mod = useCurriculumStore.getState().modules.find(m => m.id === id);
                if (mod) {
                  router.push(`/curriculum/course?id=${mod.courseId}`);
                } else {
                  router.push(`/curriculum`);
                }
                break;
              }
              case 'topic': {
                const topic = useCurriculumStore.getState().topics.find(t => t.id === id);
                if (topic) {
                  router.push(`/curriculum/course?id=${topic.courseId}`);
                } else {
                  router.push(`/curriculum`);
                }
                break;
              }
              default:
                router.push('/');
            }
          }
        }
      });
    };

    setupListener();

    return () => {
      if (listenerRef) {
        listenerRef.remove();
      }
    };
  }, [router]);

  return null;
}
