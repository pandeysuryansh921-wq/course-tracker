'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { App, URLOpenListenerEvent } from '@capacitor/app';

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
              // For topic/module we can pass them in query params so the page auto-expands
              case 'module':
              case 'topic':
                // We'd ideally need to look up the courseId for a given topic/module
                // For a robust implementation we will redirect to a generic resolver 
                // or assume we have an endpoint that looks it up.
                // For now, redirecting to curriculum.
                router.push(`/curriculum`);
                break;
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
